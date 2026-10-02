"""
Unit tests for auth.py — password hashing, tokens, and role enforcement.
No database needed: the user lookup is monkeypatched.

Run:  cd backend && python -m pytest test_auth.py -v
"""
import hashlib
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient

import auth


# ── passwords ─────────────────────────────────────────────

def test_hash_roundtrip_and_salting():
    h1, h2 = auth.hash_password("Secret123"), auth.hash_password("Secret123")
    assert h1 != h2                                   # per-user salt
    assert auth.verify_password("Secret123", h1) == (True, False)
    assert auth.verify_password("wrong-pass1", h1) == (False, False)


def test_legacy_sha256_verifies_and_requests_rehash():
    legacy = hashlib.sha256(b"admin123").hexdigest()
    assert auth.verify_password("admin123", legacy) == (True, True)
    assert auth.verify_password("nope", legacy)[0] is False


def test_legacy_bcrypt_verifies_and_requests_rehash():
    bcrypt = pytest.importorskip("bcrypt")
    legacy = bcrypt.hashpw(b"OldPass123", bcrypt.gensalt(rounds=4)).decode()
    assert auth.verify_password("OldPass123", legacy) == (True, True)
    assert auth.verify_password("wrong", legacy)[0] is False


def test_seed_placeholder_hashes_never_log_in():
    assert auth.verify_password("anything", "$2b$12$adminHashPlaceholder001xxxx") == (False, False)
    assert auth.verify_password("anything", None) == (False, False)


@pytest.mark.parametrize("pwd", ["short1", "allletters", "12345678", "x" * 129 + "1"])
def test_weak_passwords_rejected(pwd):
    with pytest.raises(HTTPException):
        auth.validate_password_strength(pwd)


def test_email_normalized():
    assert auth.normalize_email("  Jane.Doe@Example.COM ") == "jane.doe@example.com"
    with pytest.raises(HTTPException):
        auth.normalize_email("not-an-email")


# ── roles ─────────────────────────────────────────────────

@pytest.mark.parametrize("db_name,app_role", [
    ("Admin", "Admin"), ("Project Manager", "Manager"), ("Team Member", "Developer"),
    ("QA Tester", "Developer"), ("Finance", "Viewer"), (None, "Viewer"), ("Something", "Viewer"),
])
def test_role_mapping_defaults_to_least_privilege(db_name, app_role):
    assert auth.to_app_role(db_name) == app_role


# ── tokens ────────────────────────────────────────────────

def test_token_roundtrip():
    claims = auth.decode_access_token(auth.create_access_token(7, "Manager", 3))
    assert claims["sub"] == "7" and claims["role"] == "Manager" and claims["tv"] == 3


def test_tampered_and_expired_tokens_rejected():
    forged = jwt.encode({"sub": "1", "role": "Admin", "iss": "smartevm",
                         "iat": datetime.now(timezone.utc),
                         "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
                        "attacker-secret-that-is-long-enough-123", algorithm="HS256")
    with pytest.raises(jwt.InvalidSignatureError):
        auth.decode_access_token(forged)
    expired = jwt.encode({"sub": "1", "iss": "smartevm",
                          "iat": datetime.now(timezone.utc) - timedelta(hours=2),
                          "exp": datetime.now(timezone.utc) - timedelta(hours=1)},
                         auth.JWT_SECRET, algorithm="HS256")
    with pytest.raises(jwt.ExpiredSignatureError):
        auth.decode_access_token(expired)


# ── request guards ────────────────────────────────────────

USERS = {
    1: {"user_id": 1, "role": "Admin",     "is_active": True,  "token_version": 0},
    2: {"user_id": 2, "role": "Developer", "is_active": True,  "token_version": 0},
    3: {"user_id": 3, "role": "Manager",   "is_active": False, "token_version": 0},
    4: {"user_id": 4, "role": "Manager",   "is_active": True,  "token_version": 5},
}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(auth, "_cached_user", lambda uid: USERS.get(uid))
    app = FastAPI()

    @app.get("/any")
    def any_user(u=Depends(auth.get_current_user)):
        return {"id": u["user_id"]}

    @app.get("/admin-only")
    def admin_only(u=Depends(auth.require_roles(auth.ADMIN))):
        return {"ok": True}

    return TestClient(app)


def _h(uid, tv=0):
    return {"Authorization": f"Bearer {auth.create_access_token(uid, 'x', tv)}"}


def test_missing_token_is_401(client):
    r = client.get("/any")
    assert r.status_code == 401 and r.headers["www-authenticate"] == "Bearer"


def test_valid_token(client):
    assert client.get("/any", headers=_h(2)).json() == {"id": 2}


def test_role_enforced_from_db_not_token(client):
    # Token claims "Admin" but the DB says Developer -> forbidden.
    tok = auth.create_access_token(2, "Admin", 0)
    r = client.get("/admin-only", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 403
    assert client.get("/admin-only", headers=_h(1)).status_code == 200


def test_deactivated_user_blocked(client):
    assert client.get("/any", headers=_h(3)).status_code == 403


def test_revoked_token_version_is_401(client):
    assert client.get("/any", headers=_h(4, tv=4)).status_code == 401
    assert client.get("/any", headers=_h(4, tv=5)).status_code == 200


def test_unknown_user_is_401(client):
    assert client.get("/any", headers=_h(999)).status_code == 401


def test_login_rate_limit():
    ip, ident = "10.0.0.1", "ratelimit@test.com"
    for _ in range(auth._MAX_FAILS_PER_ACCOUNT):
        auth._check_rate_limit(ip, ident)
        auth._record_failure(ip, ident)
    with pytest.raises(HTTPException) as e:
        auth._check_rate_limit(ip, ident)
    assert e.value.status_code == 429
    auth._clear_failures(ident)
    auth._check_rate_limit(ip, ident)
