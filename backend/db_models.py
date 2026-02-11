from sqlalchemy import Column, String, Integer, Float, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from backend.database import Base
import uuid

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    total_files = Column(Integer, default=0)
    total_minutes = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)


class File(Base):
    __tablename__ = "files"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    saved_as = Column(String(500), nullable=False)  # Actual filename on disk
    file_size_mb = Column(Float)
    language = Column(String(10))
    transcript = Column(Text)
    summary = Column(Text)
    audio_url = Column(Text)
    duration_seconds = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    is_deleted = Column(Boolean, default=False)
    word_timestamps = Column(Text, nullable=True)
    speaker_segments = Column(Text, nullable=True)
    is_starred = Column(Boolean, default=False)
    is_pinned = Column(Boolean, default=False)