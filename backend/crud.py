from sqlalchemy.orm import Session
from backend import db_models, schemas
from typing import List, Optional

# =====================
# USER OPERATIONS
# =====================

def get_user_by_auth0_id(db: Session, auth0_user_id: str) -> Optional[db_models.User]:
    """Get user by Auth0 ID"""
    return db.query(db_models.User).filter(db_models.User.auth0_user_id == auth0_user_id).first()

def get_user_by_email(db: Session, email: str) -> Optional[db_models.User]:
    """Get user by email"""
    return db.query(db_models.User).filter(db_models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate) -> db_models.User:
    """Create new user"""
    db_user = db_models.User(
        auth0_user_id=user.auth0_user_id,
        email=user.email,
        name=user.name,
        picture=user.picture
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user_stats(db: Session, user_id: str, file_count_delta: int = 1, minutes_delta: float = 0.0):
    """Update user statistics"""
    user = db.query(db_models.User).filter(db_models.User.id == user_id).first()
    if user:
        user.total_files += file_count_delta
        user.total_minutes += minutes_delta
        db.commit()
        db.refresh(user)
    return user


# =====================
# FILE OPERATIONS
# =====================

def create_file(db: Session, file: schemas.FileCreate) -> db_models.File:
    """Create new file record"""
    db_file = db_models.File(**file.dict())
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    return db_file

def get_user_files(
    db: Session, 
    user_id: str, 
    skip: int = 0, 
    limit: int = 20,
    search: Optional[str] = None
) -> List[db_models.File]:
    """Get all files for a user with pagination and optional search"""
    query = db.query(db_models.File).filter(
        db_models.File.user_id == user_id,
        db_models.File.is_deleted == False
    )
    
    if search:
        query = query.filter(
            db_models.File.filename.contains(search) |
            db_models.File.transcript.contains(search)
        )
    
    return query.order_by(db_models.File.created_at.desc()).offset(skip).limit(limit).all()

def get_file_by_id(db: Session, file_id: str, user_id: str) -> Optional[db_models.File]:
    """Get specific file by ID (ensuring it belongs to the user)"""
    return db.query(db_models.File).filter(
        db_models.File.id == file_id,
        db_models.File.user_id == user_id,
        db_models.File.is_deleted == False
    ).first()

def delete_file(db: Session, file_id: str, user_id: str) -> bool:
    """Soft delete a file"""
    file = get_file_by_id(db, file_id, user_id)
    if file:
        file.is_deleted = True
        db.commit()
        return True
    return False

def get_user_file_count(db: Session, user_id: str) -> int:
    """Get total file count for user"""
    return db.query(db_models.File).filter(
        db_models.File.user_id == user_id,
        db_models.File.is_deleted == False
    ).count()
