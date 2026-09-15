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

# SQLAlchemy engine with NullPool to prevent connection exhaustion in serverless environments (e.g. Vercel, Neon)
engine = create_engine(DATABASE_URL, poolclass=NullPool)

def get_connection():
    try:
        connection = engine.raw_connection()
        return connection
    except Exception as e:
        print("Connection has failed:", e)
        return None

if __name__ == "__main__":
    conn = get_connection()
    if conn:
        print("Success! Python is now talking to PostgreSQL.")
        conn.close()