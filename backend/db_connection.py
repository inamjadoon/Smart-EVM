import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

from pathlib import Path
load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv()

# Pull database URL from environment; support postgres:// -> postgresql:// normalization for serverless providers
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/smartevm")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
# Pin the driver we install (psycopg2-binary): SQLAlchemy 2.1+ defaults plain postgresql:// to psycopg v3.
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

# Connection pool. Opening a TLS connection to Neon costs ~1.5-4s and every
# endpoint opens several connections, so NullPool (a fresh connection per query)
# was the main cause of slow page loads. A pool keeps warm connections:
#   - pool_pre_ping drops connections Neon closed while idle (scale-to-zero)
#   - pool_recycle refreshes them before Neon/pgbouncer idle timeouts
# Tune with DB_POOL_SIZE / DB_MAX_OVERFLOW; set DB_POOL_SIZE=0 on serverless
# hosts (e.g. Vercel) where a long-lived pool is not possible.
POOL_SIZE    = int(os.getenv("DB_POOL_SIZE", "10"))
MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "20"))

if POOL_SIZE > 0:
    engine = create_engine(
        DATABASE_URL,
        pool_size     = POOL_SIZE,
        max_overflow  = MAX_OVERFLOW,
        pool_pre_ping = True,
        pool_recycle  = 240,
        pool_timeout  = 30,
    )
else:
    engine = create_engine(DATABASE_URL, poolclass=NullPool)

def get_connection():
    """Return a DB-API connection from the pool; conn.close() hands it back to the pool."""
    try:
        connection = engine.raw_connection()
        return connection
    except Exception as e:
        print("Connection has failed:", e)
        return None

def warm_pool(n: int = 3) -> None:
    """Open a few connections at startup so the first page load skips the TLS handshake."""
    conns = []
    try:
        for _ in range(max(0, min(n, POOL_SIZE))):
            c = get_connection()
            if c:
                conns.append(c)
    finally:
        for c in conns:
            c.close()

if __name__ == "__main__":
    conn = get_connection()
    if conn:
        print("Success! Python is now talking to PostgreSQL.")
        conn.close()
