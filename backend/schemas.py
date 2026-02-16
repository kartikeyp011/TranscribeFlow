from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# =====================================================
# User Schemas
# =====================================================

class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str  # ✅ Plain password (will be hashed)
    name: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: EmailStr
    name: Optional[str] = None
    created_at: datetime
    total_files: int
    total_minutes: float
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[str] = None


# File Schemas
class FileBase(BaseModel):
    filename: str
    file_size_mb: Optional[float] = None
    language: Optional[str] = None

class FileCreate(FileBase):
    user_id: str
    saved_as: str
    content_file: Optional[str] = None   # Path to JSON content file on disk
    audio_url: Optional[str] = None

class FileResponse(FileBase):
    id: str
    user_id: str
    saved_as: str
    content_file: Optional[str] = None
    # These are populated at runtime by reading the content file:
    transcript: Optional[str] = None
    summary: Optional[str] = None
    audio_url: Optional[str] = None
    created_at: datetime
    word_timestamps: Optional[str] = None
    speaker_segments: Optional[str] = None
    
    class Config:
        from_attributes = True


# Statistics Schema
class UserStatsResponse(BaseModel):
    total_files: int
    total_minutes: float
    recent_files_count: int
    account_created: datetime