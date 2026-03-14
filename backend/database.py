import os
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")

# CockroachDB requires the driver prefix to be postgresql+psycopg2
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(
    DATABASE_URL,
    connect_args={
        "sslmode": "require",
        "application_name": "transcribeflow",
    },
    pool_pre_ping=True,
    pool_recycle=300,
    echo=False,
)

# Fix: CockroachDB returns its own version string which SQLAlchemy
# cannot parse. This patches the dialect to report a known PG version.
from sqlalchemy.dialects.postgresql.psycopg2 import PGDialect_psycopg2
PGDialect_psycopg2._get_server_version_info = lambda self, conn: (9, 5, 0)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()