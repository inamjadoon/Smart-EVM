"""
Authentication & role-based access control (RBAC) for SmartEVM.

Roles (application level)          Stored in Roles.role_name as
  Admin     - everything, user management     'Admin'
  Manager   - projects, sprints, tasks, ML    'Project Manager'
  Developer - own tasks, metrics, read-only   'Team Member'   ('QA Tester' also maps here)
  Viewer    - read-only                       'Viewer'        ('Finance' also maps here)

Security model
  * Passwords: PBKDF2-HMAC-SHA256 (600k iterations, per-user salt; stdlib only).
    Legacy unsalted SHA-256 hashes still verify once and are upgraded on login.
  * Sessions: signed JWT (HS256) sent as `Authorization: Bearer <token>`.
    Each token carries the user's `token_version`; bumping it (password change,
    reset, deactivation, "log out everywhere") revokes every older token.
  * Role and active status are always read from the database (cached ~30s and
    invalidated on change), never trusted from the token.
  * Public sign-up always creates a Developer. Only an Admin can grant roles.
  * One bootstrap Admin is created from ADMIN_EMAIL / ADMIN_PASSWORD on startup.

Env vars: JWT_SECRET, JWT_EXPIRE_MINUTES, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME,
          ALLOW_SIGNUP
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import re
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Any, Deque, Dict, List, Optional, Tuple

import jwt
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from db_connection import get_connection

log = logging.getLogger("smartevm.auth")

# ─────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────

JWT_ALGORITHM      = "HS256"
JWT_ISSUER         = "smartevm"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))   # 8h working day
ALLOW_SIGNUP       = os.getenv("ALLOW_SIGNUP", "true").strip().lower() in ("1", "true", "yes")

JWT_SECRET = os.getenv("JWT_SECRET", "")
if len(JWT_SECRET) < 32:
    # Never run with a weak/missing secret. A random one keeps dev working, but
    # every restart signs everyone out — set JWT_SECRET in backend/.env.
    log.warning("JWT_SECRET missing or shorter than 32 chars; using a random per-process secret.")
    JWT_SECRET = secrets.token_urlsafe(48)

PBKDF2_ITERATIONS = 600_000
_HASH_PREFIX      = "pbkdf2_sha256"

ADMIN, MANAGER, DEVELOPER, VIEWER = "Admin", "Manager", "Developer", "Viewer"
APP_ROLES   = (ADMIN, MANAGER, DEVELOPER, VIEWER)
ALL_ROLES   = APP_ROLES
EDITORS     = (ADMIN, MANAGER)
CONTRIBUTORS = (ADMIN, MANAGER, DEVELOPER)

# DB role_name (lower-case) -> application role. Unknown roles get least privilege.
_DB_TO_APP = {
    "admin": ADMIN,
    "project manager": MANAGER, "manager": MANAGER,
    "team member": DEVELOPER, "developer": DEVELOPER, "qa tester": DEVELOPER,
    "finance": VIEWER, "viewer": VIEWER,
}
_APP_TO_DB = {ADMIN: "Admin", MANAGER: "Project Manager", DEVELOPER: "Team Member", VIEWER: "Viewer"}

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def to_app_role(db_role_name: Optional[str]) -> str:
    return _DB_TO_APP.get((db_role_name or "").strip().lower(), VIEWER)


# ─────────────────────────────────────────────
#  PASSWORDS
# ─────────────────────────────────────────────

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    b64 = lambda b: base64.b64encode(b).decode()
    return f"{_HASH_PREFIX}${PBKDF2_ITERATIONS}${b64(salt)}${b64(dk)}"


def is_modern_hash(stored: Optional[str]) -> bool:
    return bool(stored) and stored.startswith(_HASH_PREFIX + "$")


def verify_password(password: str, stored: Optional[str]) -> Tuple[bool, bool]:
    """Return (ok, needs_rehash)."""
    if not stored or password is None:
        return False, False
    if is_modern_hash(stored):
        try:
            _, iters, salt_b64, hash_b64 = stored.split("$")
            dk = hashlib.pbkdf2_hmac("sha256", password.encode(),
                                     base64.b64decode(salt_b64), int(iters))
            ok = hmac.compare_digest(dk, base64.b64decode(hash_b64))
            return ok, ok and int(iters) < PBKDF2_ITERATIONS
        except Exception:
            return False, False
    # Legacy: unsalted SHA-256 hex written by an earlier prototype.
    if re.fullmatch(r"[0-9a-f]{64}", stored):
        ok = hmac.compare_digest(hashlib.sha256(password.encode()).hexdigest(), stored)
        return ok, ok
    # Legacy: real bcrypt hashes (60 chars). Seed placeholders also start with $2b$
    # but are shorter, so they never match.
    if len(stored) == 60 and stored.startswith(("$2a$", "$2b$", "$2y$")):
        try:
            import bcrypt
            ok = bcrypt.checkpw(password.encode()[:72], stored.encode())
            return ok, ok
        except Exception:
            return False, False
    return False, False   # seed placeholders etc. can never log in


_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


def validate_password_strength(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")
    if len(password) > 128:
        raise HTTPException(status_code=422, detail="Password must be at most 128 characters.")
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise HTTPException(status_code=422, detail="Password must contain at least one letter and one number.")


def normalize_email(email: str) -> str:
    email = (email or "").strip().lower()
    if not _EMAIL_RE.match(email) or len(email) > 100:
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    return email


# ─────────────────────────────────────────────
#  TOKENS
# ─────────────────────────────────────────────

def create_access_token(user_id: int, role: str, token_version: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id), "role": role, "tv": int(token_version or 0),
        "iss": JWT_ISSUER, "iat": now, "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM], issuer=JWT_ISSUER,
                      options={"require": ["exp", "iat", "sub"]})


# ─────────────────────────────────────────────
#  DB HELPERS
# ─────────────────────────────────────────────

def _fetch(sql: str, params: tuple = (), one: bool = False):
    conn = get_connection()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable. Please try again.")
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        return cur.fetchone() if one else cur.fetchall()
    finally:
        conn.close()


def _write(sql: str, params: tuple = (), returning: bool = False):
    conn = get_connection()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable. Please try again.")
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        row = cur.fetchone() if returning else None
        conn.commit()
        return row
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


_USER_COLUMNS = """
    u.user_id, u.username, u.full_name, u.organization, u.is_active,
    u.token_version, u.created_at, u.last_login_at, r.role_name, u.password_hash,
    u.reports_to, (SELECT COALESCE(m.full_name, m.username) FROM Users m WHERE m.user_id = u.reports_to)
"""
_N_USER_COLUMNS = 12


_RETURNING_USER = """
    RETURNING user_id, username, full_name, organization, is_active, token_version, created_at,
              last_login_at, (SELECT role_name FROM Roles r WHERE r.role_id = Users.role_id), password_hash,
              reports_to, (SELECT COALESCE(m.full_name, m.username) FROM Users m WHERE m.user_id = Users.reports_to)
"""


def _write_user(sql: str, params: tuple) -> Optional[Dict[str, Any]]:
    """INSERT/UPDATE on Users that returns the resulting user in the same round trip."""
    row = _write(sql + _RETURNING_USER, params, returning=True)
    return _row_to_user(row) if row else None


def _row_to_user(row) -> Dict[str, Any]:
    (uid, username, full_name, org, active, tv, created, last_login, role_name, pwd_hash,
     reports_to, manager_name) = row
    return {
        "user_id": uid,
        "email": username,
        "username": username,
        "full_name": full_name or username,
        "organization": org,
        "is_active": bool(active),
        "token_version": int(tv or 0),
        "role": to_app_role(role_name),
        "created_at": created.isoformat() if created else None,
        "last_login_at": last_login.isoformat() if last_login else None,
        "reports_to": reports_to,            # the manager whose team this user is on (set by an Admin)
        "manager_name": manager_name,
        "_password_hash": pwd_hash,
    }


def public_user(u: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in u.items() if not k.startswith("_") and k != "token_version"}


def _get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    row = _fetch(f"SELECT {_USER_COLUMNS} FROM Users u LEFT JOIN Roles r ON r.role_id = u.role_id "
                 "WHERE u.user_id = %s", (user_id,), one=True)
    return _row_to_user(row) if row else None


def _get_user_by_login(identifier: str) -> Optional[Dict[str, Any]]:
    row = _fetch(f"SELECT {_USER_COLUMNS} FROM Users u LEFT JOIN Roles r ON r.role_id = u.role_id "
                 "WHERE LOWER(u.username) = LOWER(%s)", (identifier.strip(),), one=True)
    return _row_to_user(row) if row else None


_role_ids: Dict[str, int] = {}


def role_id_for(app_role: str) -> int:
    if app_role not in APP_ROLES:
        raise HTTPException(status_code=422, detail=f"Role must be one of: {', '.join(APP_ROLES)}")
    if app_role not in _role_ids:
        db_name = _APP_TO_DB[app_role]
        row = _fetch("SELECT role_id FROM Roles WHERE LOWER(role_name) = LOWER(%s)", (db_name,), one=True)
        if not row:
            row = _write("INSERT INTO Roles (role_name) VALUES (%s) RETURNING role_id", (db_name,), returning=True)
        _role_ids[app_role] = row[0]
    return _role_ids[app_role]


# Short-lived cache so every authenticated request doesn't add a Neon round trip.
_USER_CACHE_TTL = 30.0
_user_cache: Dict[int, Tuple[float, Dict[str, Any]]] = {}
_user_cache_lock = threading.Lock()


def _cached_user(user_id: int) -> Optional[Dict[str, Any]]:
    now = time.monotonic()
    hit = _user_cache.get(user_id)
    if hit and hit[0] > now:
        return hit[1]
    with _user_cache_lock:          # one fetch per user even under a burst of parallel requests
        hit = _user_cache.get(user_id)
        if hit and hit[0] > time.monotonic():
            return hit[1]
        user = _get_user_by_id(user_id)
        if user:
            _user_cache[user_id] = (time.monotonic() + _USER_CACHE_TTL, user)
        return user


def invalidate_user(user_id: int) -> None:
    _user_cache.pop(user_id, None)


# ─────────────────────────────────────────────
#  STARTUP: schema + bootstrap admin
# ─────────────────────────────────────────────

def ensure_auth_schema() -> None:
    """Idempotent, additive migration for the auth columns (safe to run on every start)."""
    conn = get_connection()
    if not conn:
        log.error("Auth schema check skipped: database unavailable.")
        return
    try:
        cur = conn.cursor()
        cur.execute("""
            ALTER TABLE Users
                ADD COLUMN IF NOT EXISTS full_name     VARCHAR(150),
                ADD COLUMN IF NOT EXISTS organization  VARCHAR(150),
                ADD COLUMN IF NOT EXISTS is_active     BOOLEAN   NOT NULL DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS token_version INT       NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS reports_to    INT REFERENCES Users(user_id) ON DELETE SET NULL
        """)
        for db_name in _APP_TO_DB.values():
            cur.execute("""
                INSERT INTO Roles (role_name) SELECT %s
                WHERE NOT EXISTS (SELECT 1 FROM Roles WHERE LOWER(role_name) = LOWER(%s))
            """, (db_name, db_name))
        conn.commit()
    except Exception as e:
        conn.rollback()
        log.error("Auth schema migration failed: %s", e)
    finally:
        conn.close()
    try:
        _write("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_ci ON Users (LOWER(username))")
    except Exception as e:
        log.warning("Case-insensitive username index not created (duplicate usernames?): %s", e)


def ensure_bootstrap_admin() -> None:
    email = (os.getenv("ADMIN_EMAIL") or "").strip().lower()
    password = os.getenv("ADMIN_PASSWORD") or ""
    name = os.getenv("ADMIN_NAME") or "System Administrator"
    if not email:
        log.warning("ADMIN_EMAIL not set; no bootstrap admin was created/verified.")
        return
    admin_role = role_id_for(ADMIN)
    existing = _get_user_by_login(email)
    if existing is None:
        if not password:
            log.warning("ADMIN_PASSWORD not set; cannot create bootstrap admin %s.", email)
            return
        _write("INSERT INTO Users (username, password_hash, role_id, full_name, is_active) "
               "VALUES (%s, %s, %s, %s, TRUE)", (email, hash_password(password), admin_role, name))
        log.info("Bootstrap admin %s created.", email)
        return
    # Keep the bootstrap account an active Admin. Only replace its password when the
    # stored hash is legacy/unusable, so a password changed in the UI survives restarts.
    if password and not is_modern_hash(existing["_password_hash"]):
        _write("UPDATE Users SET role_id = %s, is_active = TRUE, password_hash = %s, "
               "token_version = token_version + 1 WHERE user_id = %s",
               (admin_role, hash_password(password), existing["user_id"]))
    elif existing["role"] != ADMIN or not existing["is_active"]:
        _write("UPDATE Users SET role_id = %s, is_active = TRUE WHERE user_id = %s",
               (admin_role, existing["user_id"]))


# ─────────────────────────────────────────────
#  DEPENDENCIES (use these to protect routes)
# ─────────────────────────────────────────────

_bearer = HTTPBearer(auto_error=False)


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail,
                         headers={"WWW-Authenticate": "Bearer"})


def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer)) -> Dict[str, Any]:
    if creds is None or creds.scheme.lower() != "bearer" or not creds.credentials:
        raise _unauthorized()
    try:
        claims = decode_access_token(creds.credentials)
        user_id = int(claims["sub"])
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Your session has expired. Please sign in again.")
    except (jwt.PyJWTError, KeyError, ValueError):
        raise _unauthorized("Invalid authentication token.")
    user = _cached_user(user_id)
    if not user or int(claims.get("tv", -1)) != user["token_version"]:
        raise _unauthorized("Your session is no longer valid. Please sign in again.")
    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="Your account has been deactivated. Contact an administrator.")
    return user


def require_roles(*roles: str):
    allowed = set(roles)

    def checker(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        if user["role"] not in allowed:
            raise HTTPException(status_code=403,
                                detail=f"Your role ({user['role']}) is not allowed to perform this action.")
        return user
    return checker


# ─────────────────────────────────────────────
#  LOGIN RATE LIMITING (in-process)
# ─────────────────────────────────────────────

_FAIL_WINDOW = 15 * 60
_MAX_FAILS_PER_ACCOUNT = 5
_MAX_FAILS_PER_IP = 30
_failures: Dict[str, Deque[float]] = defaultdict(deque)
_fail_lock = threading.Lock()


def _recent(key: str, now: float) -> Deque[float]:
    q = _failures[key]
    while q and q[0] < now - _FAIL_WINDOW:
        q.popleft()
    return q


def _check_rate_limit(ip: str, identifier: str) -> None:
    now = time.time()
    with _fail_lock:
        acct, ipq = _recent(f"a:{identifier}", now), _recent(f"i:{ip}", now)
        if len(acct) >= _MAX_FAILS_PER_ACCOUNT or len(ipq) >= _MAX_FAILS_PER_IP:
            oldest = min(q[0] for q in (acct, ipq) if q)
            retry = int(_FAIL_WINDOW - (now - oldest)) + 1
            raise HTTPException(status_code=429, headers={"Retry-After": str(retry)},
                                detail=f"Too many failed sign-in attempts. Try again in {max(1, retry // 60)} minute(s).")


def _record_failure(ip: str, identifier: str) -> None:
    now = time.time()
    with _fail_lock:
        _failures[f"a:{identifier}"].append(now)
        _failures[f"i:{ip}"].append(now)


def _clear_failures(identifier: str) -> None:
    with _fail_lock:
        _failures.pop(f"a:{identifier}", None)


# ─────────────────────────────────────────────
#  SCHEMAS
# ─────────────────────────────────────────────

class RegisterIn(BaseModel):
    full_name   : str           = Field(..., min_length=1, max_length=150)
    email       : str           = Field(..., min_length=3, max_length=100)
    password    : str           = Field(..., min_length=1, max_length=128)
    organization: Optional[str] = Field(default=None, max_length=150)


class LoginIn(BaseModel):
    email   : str = Field(..., min_length=1, max_length=100, description="Email (or legacy username)")
    password: str = Field(..., min_length=1, max_length=128)


class ProfileUpdate(BaseModel):
    full_name   : Optional[str] = Field(default=None, min_length=1, max_length=150)
    organization: Optional[str] = Field(default=None, max_length=150)


class ChangePasswordIn(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password    : str = Field(..., min_length=1, max_length=128)


class AdminCreateUser(RegisterIn):
    role: str = Field(default=DEVELOPER)


class AdminUpdateUser(BaseModel):
    reports_to  : Optional[int]  = None   # manager's user_id; send null to remove from a team
    role        : Optional[str]  = None
    is_active   : Optional[bool] = None
    full_name   : Optional[str]  = Field(default=None, min_length=1, max_length=150)
    organization: Optional[str]  = Field(default=None, max_length=150)


class ResetPasswordIn(BaseModel):
    new_password: str = Field(..., min_length=1, max_length=128)


def _clean_name(name: str) -> str:
    name = (name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Full name is required.")
    return name


def _audit(*args, **kwargs) -> None:
    from access import audit          # lazy: access.py imports this module
    audit(*args, **kwargs)


def _token_response(user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "access_token": create_access_token(user["user_id"], user["role"], user["token_version"]),
        "token_type": "bearer",
        "expires_in": JWT_EXPIRE_MINUTES * 60,
        "user": public_user(user),
    }


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


# ─────────────────────────────────────────────
#  /auth
# ─────────────────────────────────────────────

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", status_code=201, summary="Create an account (always starts as Developer)")
def register(body: RegisterIn):
    if not ALLOW_SIGNUP:
        raise HTTPException(status_code=403, detail="Self sign-up is disabled. Ask an administrator for an account.")
    email = normalize_email(body.email)
    validate_password_strength(body.password)
    if _get_user_by_login(email):
        raise HTTPException(status_code=409, detail="An account with this email already exists. Please sign in.")
    try:
        user = _write_user(
            "INSERT INTO Users (username, password_hash, role_id, full_name, organization, is_active) "
            "VALUES (%s, %s, %s, %s, %s, TRUE)",
            (email, hash_password(body.password), role_id_for(DEVELOPER),
             _clean_name(body.full_name), (body.organization or "").strip() or None),
        )
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="An account with this email already exists. Please sign in.")
        raise
    _audit(user, "auth.register", "user", user["user_id"])
    return _token_response(user)


def _record_login(user_id: int, new_hash: Optional[str]) -> None:
    """Runs after the response is sent, so sign-in doesn't wait on these writes."""
    try:
        if new_hash:
            _write("UPDATE Users SET password_hash = %s, last_login_at = CURRENT_TIMESTAMP WHERE user_id = %s",
                   (new_hash, user_id))
        else:
            _write("UPDATE Users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = %s", (user_id,))
        invalidate_user(user_id)
    except Exception as e:
        log.warning("Could not record login for user %s: %s", user_id, e)


@router.post("/login", summary="Sign in with email + password")
def login(body: LoginIn, request: Request, background: BackgroundTasks):
    identifier = body.email.strip().lower()
    ip = _client_ip(request)
    _check_rate_limit(ip, identifier)

    user = _get_user_by_login(identifier)
    ok, needs_rehash = verify_password(body.password, user["_password_hash"] if user else _DUMMY_HASH)
    if not user or not ok:
        _record_failure(ip, identifier)
        _audit(user, "auth.login_failed", "user", user["user_id"] if user else None, email=identifier, ip=ip)
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not user["is_active"]:
        _audit(user, "auth.login_blocked", "user", user["user_id"], reason="deactivated", ip=ip)
        raise HTTPException(status_code=403, detail="Your account has been deactivated. Contact an administrator.")

    _clear_failures(identifier)
    _audit(user, "auth.login", "user", user["user_id"], ip=ip)
    background.add_task(_record_login, user["user_id"],
                        hash_password(body.password) if needs_rehash else None)
    user["last_login_at"] = datetime.now(timezone.utc).isoformat()
    return _token_response(user)


@router.get("/me", summary="Current user profile")
def me(user: Dict[str, Any] = Depends(get_current_user)):
    return public_user(user)


@router.patch("/me", summary="Update own name / organization")
def update_me(body: ProfileUpdate, user: Dict[str, Any] = Depends(get_current_user)):
    updated = _write_user(
        "UPDATE Users SET full_name = COALESCE(%s, full_name), organization = COALESCE(%s, organization) "
        "WHERE user_id = %s",
        (_clean_name(body.full_name) if body.full_name is not None else None,
         body.organization.strip() if body.organization is not None else None,
         user["user_id"]))
    invalidate_user(user["user_id"])
    return public_user(updated)


@router.post("/change-password", summary="Change own password (signs out other sessions)")
def change_password(body: ChangePasswordIn, user: Dict[str, Any] = Depends(get_current_user)):
    ok, _ = verify_password(body.current_password, user["_password_hash"])
    if not ok:
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    validate_password_strength(body.new_password)
    updated = _write_user("UPDATE Users SET password_hash = %s, token_version = token_version + 1 WHERE user_id = %s",
                          (hash_password(body.new_password), user["user_id"]))
    invalidate_user(user["user_id"])
    return _token_response(updated)


@router.post("/logout", status_code=204, summary="Sign out (client discards its token)")
def logout(_: Dict[str, Any] = Depends(get_current_user)):
    return None


@router.post("/logout-all", status_code=204, summary="Sign out of every device")
def logout_all(user: Dict[str, Any] = Depends(get_current_user)):
    _write("UPDATE Users SET token_version = token_version + 1 WHERE user_id = %s", (user["user_id"],))
    invalidate_user(user["user_id"])
    return None


# ─────────────────────────────────────────────
#  PROGRESS STATS (shared by /admin and /team)
# ─────────────────────────────────────────────

def _user_progress(include_inactive: bool, project_ids: Optional[List[int]] = None) -> List[Dict[str, Any]]:
    """Per-user task stats. With project_ids, only tasks in those projects are counted."""
    rows = _fetch(f"""
        SELECT {_USER_COLUMNS},
               COUNT(t.task_id)                                               AS total_tasks,
               COUNT(t.task_id) FILTER (WHERE t.status = 'Done')              AS done_tasks,
               COUNT(t.task_id) FILTER (WHERE t.status = 'In Progress')       AS in_progress_tasks,
               COUNT(t.task_id) FILTER (WHERE t.status = 'To Do')             AS todo_tasks,
               COALESCE(SUM(t.story_points), 0)                               AS total_points,
               COALESCE(SUM(t.story_points) FILTER (WHERE t.status = 'Done'), 0) AS done_points,
               COUNT(DISTINCT s.project_id)                                   AS active_projects,
               (SELECT COUNT(*) FROM Projects p WHERE p.manager_id = u.user_id) AS managed_projects
        FROM Users u
        LEFT JOIN Roles   r ON r.role_id   = u.role_id
        LEFT JOIN (Tasks t JOIN Sprints s ON s.sprint_id = t.sprint_id
                   AND (%s::int[] IS NULL OR s.project_id = ANY(%s::int[])))
               ON t.assigned_to = u.user_id
        {"" if include_inactive else "WHERE u.is_active"}
        GROUP BY u.user_id, r.role_name
        ORDER BY u.user_id
    """, (project_ids, project_ids))
    out = []
    for row in rows:
        user = public_user(_row_to_user(row[:_N_USER_COLUMNS]))
        total, done, inprog, todo, pts, done_pts, projects, managed = row[_N_USER_COLUMNS:]
        user["progress"] = {
            "total_tasks": total, "done_tasks": done, "in_progress_tasks": inprog, "todo_tasks": todo,
            "total_points": int(pts), "done_points": int(done_pts),
            "completion_pct": round(100.0 * done / total, 1) if total else 0.0,
            "active_projects": projects, "managed_projects": managed,
        }
        out.append(user)
    return out


# ─────────────────────────────────────────────
#  /team  (Admin + Manager)
# ─────────────────────────────────────────────

team_router = APIRouter(prefix="/team", tags=["Team"])


def team_members_progress(user: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Admin: everyone except admins, across all projects.
    Manager: the developers on their team (assigned by an Admin), counting work on the manager's projects."""
    if user["role"] == ADMIN:
        return [u for u in _user_progress(include_inactive=False) if u["role"] != ADMIN]
    from access import project_ids_for
    managed = sorted(project_ids_for(user) or [])
    return [u for u in _user_progress(include_inactive=False, project_ids=managed)
            if u["reports_to"] == user["user_id"]]


@team_router.get("/progress", summary="Per-member task progress")
def team_progress(user: Dict[str, Any] = Depends(require_roles(*EDITORS))):
    return team_members_progress(user)


# ─────────────────────────────────────────────
#  /admin  (Admin only)
# ─────────────────────────────────────────────

admin_router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_roles(ADMIN))])


def _active_admin_count() -> int:
    row = _fetch("SELECT COUNT(*) FROM Users WHERE role_id = %s AND is_active", (role_id_for(ADMIN),), one=True)
    return int(row[0])


@admin_router.get("/overview", summary="Workspace totals")
def admin_overview():
    users = _user_progress(include_inactive=True)
    by_role = {r: 0 for r in APP_ROLES}
    for u in users:
        if u["is_active"]:
            by_role[u["role"]] += 1
    proj, tasks = _fetch("""
        SELECT (SELECT COUNT(*) FROM Projects),
               (SELECT json_build_object(
                   'total',       COUNT(*),
                   'done',        COUNT(*) FILTER (WHERE status = 'Done'),
                   'in_progress', COUNT(*) FILTER (WHERE status = 'In Progress'),
                   'todo',        COUNT(*) FILTER (WHERE status = 'To Do'),
                   'unassigned',  COUNT(*) FILTER (WHERE assigned_to IS NULL)) FROM Tasks)
    """, one=True)
    return {
        "users_total": len(users),
        "users_active": sum(1 for u in users if u["is_active"]),
        "users_by_role": by_role,
        "projects_total": proj,
        "tasks": tasks,
    }


@admin_router.get("/users", summary="All users with progress")
def admin_list_users():
    return _user_progress(include_inactive=True)


@admin_router.post("/users", status_code=201, summary="Create a user with any role")
def admin_create_user(body: AdminCreateUser, me_: Dict[str, Any] = Depends(get_current_user)):
    email = normalize_email(body.email)
    validate_password_strength(body.password)
    if _get_user_by_login(email):
        raise HTTPException(status_code=409, detail="A user with this email already exists.")
    user = _write_user(
        "INSERT INTO Users (username, password_hash, role_id, full_name, organization, is_active) "
        "VALUES (%s, %s, %s, %s, %s, TRUE)",
        (email, hash_password(body.password), role_id_for(body.role),
         _clean_name(body.full_name), (body.organization or "").strip() or None),
    )
    _audit(me_, "user.create", "user", user["user_id"], email=email, role=body.role)
    return public_user(user)


@admin_router.patch("/users/{user_id}", summary="Change role / activate / deactivate")
def admin_update_user(user_id: int, body: AdminUpdateUser, me_: Dict[str, Any] = Depends(get_current_user)):
    target = _get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if user_id == me_["user_id"] and (
        (body.role is not None and body.role != ADMIN) or body.is_active is False
    ):
        raise HTTPException(status_code=400, detail="You cannot remove your own admin access or deactivate yourself.")
    removing_admin = target["role"] == ADMIN and target["is_active"] and (
        (body.role is not None and body.role != ADMIN) or body.is_active is False)
    if removing_admin and _active_admin_count() <= 1:
        raise HTTPException(status_code=400, detail="The workspace must keep at least one active admin.")

    sets, params = [], []
    if "reports_to" in body.model_fields_set:
        if body.reports_to is not None:
            mgr = _get_user_by_id(body.reports_to)
            if not mgr or not mgr["is_active"] or mgr["role"] not in EDITORS:
                raise HTTPException(status_code=422, detail="A team must be led by an active Manager or Admin.")
            if body.reports_to == user_id:
                raise HTTPException(status_code=422, detail="A user cannot be on their own team.")
        sets.append("reports_to = %s"); params.append(body.reports_to)
    if body.role is not None:
        sets.append("role_id = %s"); params.append(role_id_for(body.role))
    if body.is_active is not None:
        sets.append("is_active = %s"); params.append(body.is_active)
        if not body.is_active:
            sets.append("token_version = token_version + 1")    # kill live sessions
    if body.full_name is not None:
        sets.append("full_name = %s"); params.append(_clean_name(body.full_name))
    if body.organization is not None:
        sets.append("organization = %s"); params.append(body.organization.strip() or None)
    if not sets:
        return public_user(target)
    updated = _write_user(f"UPDATE Users SET {', '.join(sets)} WHERE user_id = %s", (*params, user_id))
    invalidate_user(user_id)
    from access import invalidate_scope
    invalidate_scope()
    changes = {k: v for k, v in body.model_dump().items() if v is not None or k in body.model_fields_set}
    if body.role is not None and body.role != target["role"]:
        changes["previous_role"] = target["role"]
    _audit(me_, "user.update", "user", user_id, email=target["email"], **changes)
    return public_user(updated)


@admin_router.post("/users/{user_id}/reset-password", summary="Set a new password (signs the user out)")
def admin_reset_password(user_id: int, body: ResetPasswordIn, me_: Dict[str, Any] = Depends(get_current_user)):
    target = _get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    validate_password_strength(body.new_password)
    _write("UPDATE Users SET password_hash = %s, token_version = token_version + 1 WHERE user_id = %s",
           (hash_password(body.new_password), user_id))
    invalidate_user(user_id)
    _audit(me_, "user.password_reset", "user", user_id, email=target["email"])
    return {"message": "Password reset. The user must sign in again with the new password."}


@admin_router.get("/activity", summary="Audit log: who did what, newest first")
def admin_activity(limit: int = 100, user_id: Optional[int] = None):
    from access import recent_activity
    return recent_activity(limit=limit, user_id=user_id)
