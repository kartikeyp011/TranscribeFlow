import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# MySQL connection configuration from environment variables
MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = os.getenv("MYSQL_PORT", "3306")
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD")
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "transcribeflow")

# SQLAlchemy database URL
DATABASE_URL = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}"

# Create SQLAlchemy engine (manages DB connection pool)
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Validate connection before use
    pool_recycle=3600,   # Avoid MySQL timeout issues
    echo=False           # Enable for SQL debugging
)

# Session factory used to create DB sessions per request
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all ORM models
Base = declarative_base()

# Dependency that provides a DB session and ensures it closes after request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()