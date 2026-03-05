from sqlalchemy import Column, String, Integer, Float, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from backend.database import Base
import uuid


class User(Base):
    """
    ORM model representing application users.

    Stores authentication credentials along with basic usage
    statistics such as number of uploaded files and total
    transcription minutes.
    """
    __tablename__ = "users"
    
    # Primary key stored as UUID string
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Unique username used for login
    username = Column(String(100), unique=True, nullable=False, index=True)
    
    # User email (also unique for account recovery / login)
    email = Column(String(255), unique=True, nullable=False, index=True)
    
    # Securely hashed password (never store raw passwords)
    hashed_password = Column(String(255), nullable=False)
    
    # Optional display name
    name = Column(String(255))
    
    # Timestamp when the user account was created
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Automatically updated timestamp on record update
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Usage metrics for dashboard or analytics
    total_files = Column(Integer, default=0)
    total_minutes = Column(Float, default=0.0)
    
    # Indicates whether the account is active
    is_active = Column(Boolean, default=True)


class File(Base):
    """
    ORM model representing uploaded audio files and their metadata.

    Each file belongs to a user and stores information required
    for transcription processing and file management features.
    """
    __tablename__ = "files"
    
    # Primary key stored as UUID
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Reference to the user who uploaded the file
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Original filename uploaded by the user
    filename = Column(String(255), nullable=False)
    
    # Actual stored filename/path on disk
    saved_as = Column(String(500), nullable=False)
    
    # File size stored in MB
    file_size_mb = Column(Float)
    
    # Language of the audio/transcription
    language = Column(String(10))
    
    # Path to processed transcript JSON content
    content_file = Column(String(500), nullable=True)
    
    # Public or internal audio URL if applicable
    audio_url = Column(Text)
    
    # Duration of the audio file in seconds
    duration_seconds = Column(Float, nullable=True)
    
    # Upload timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Soft delete flag (file remains in DB but hidden from queries)
    is_deleted = Column(Boolean, default=False)
    
    # User UI features
    is_starred = Column(Boolean, default=False)
    is_pinned = Column(Boolean, default=False)