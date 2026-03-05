from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# =====================================================
# User Schemas
# =====================================================

class UserBase(BaseModel):
    """Base schema shared across user-related models."""
    email: EmailStr
    name: Optional[str] = None


class UserCreate(BaseModel):
    """
    Schema used when creating a new user account.
    Password is received in plain text and hashed before storage.
    """
    username: str
    email: EmailStr
    password: str  # Plain password (hashed in security layer)
    name: Optional[str] = None


class UserLogin(BaseModel):
    """Schema used for login requests."""
    username: str
    password: str


class UpdateUsername(BaseModel):
    """Request model for updating a user's username."""
    new_username: str


class ChangePassword(BaseModel):
    """Request model for password change operations."""
    current_password: str
    new_password: str


class UserResponse(BaseModel):
    """
    User data returned in API responses.
    Excludes sensitive fields like hashed_password.
    """
    id: str
    username: str
    email: EmailStr
    name: Optional[str] = None
    created_at: datetime
    total_files: int
    total_minutes: float
    
    class Config:
        # Allows returning SQLAlchemy models directly
        from_attributes = True


class Token(BaseModel):
    """JWT authentication token response."""
    access_token: str
    token_type: str


class TokenData(BaseModel):
    """Data extracted from JWT payload."""
    user_id: Optional[str] = None


# =====================================================
# File Schemas
# =====================================================

class FileBase(BaseModel):
    """Common file metadata shared across file schemas."""
    filename: str
    file_size_mb: Optional[float] = None
    language: Optional[str] = None


class FileCreate(FileBase):
    """
    Schema used when storing a new uploaded file in the database.
    Contains metadata and reference to stored content file.
    """
    user_id: str
    saved_as: str
    content_file: Optional[str] = None   # JSON file containing transcript data
    audio_url: Optional[str] = None
    duration_seconds: Optional[float] = None


class FileResponse(FileBase):
    """
    File data returned to the client.

    Transcript and summary are loaded dynamically from
    the JSON content file rather than stored directly in DB.
    """
    id: str
    user_id: str
    saved_as: str
    content_file: Optional[str] = None

    # Populated at runtime after reading content JSON
    transcript: Optional[str] = None
    summary: Optional[str] = None

    audio_url: Optional[str] = None
    created_at: datetime

    # Optional transcription metadata
    word_timestamps: Optional[str] = None
    speaker_segments: Optional[str] = None
    
    class Config:
        from_attributes = True


# =====================================================
# Statistics Schema
# =====================================================

class UserStatsResponse(BaseModel):
    """
    Response schema used for dashboard statistics.
    """
    total_files: int
    total_minutes: float
    recent_files_count: int
    account_created: datetime