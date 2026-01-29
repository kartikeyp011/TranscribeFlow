from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None

class UserCreate(UserBase):
    auth0_user_id: str
    picture: Optional[str] = None

class UserResponse(UserBase):
    id: str
    auth0_user_id: str
    picture: Optional[str] = None
    created_at: datetime
    total_files: int
    total_minutes: float
    
    class Config:
        from_attributes = True


# File Schemas
class FileBase(BaseModel):
    filename: str
    file_size_mb: Optional[float] = None
    language: Optional[str] = None

class FileCreate(FileBase):
    user_id: str
    saved_as: str
    transcript: Optional[str] = None
    summary: Optional[str] = None
    audio_url: Optional[str] = None

class FileResponse(FileBase):
    id: str
    user_id: str
    saved_as: str
    transcript: Optional[str] = None
    summary: Optional[str] = None
    audio_url: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# Statistics Schema
class UserStatsResponse(BaseModel):
    total_files: int
    total_minutes: float
    recent_files_count: int
    account_created: 
