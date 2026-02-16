from sqlalchemy.orm import Session
from backend import db_models, schemas
from typing import List, Optional

# =====================================================
# USER OPERATIONS
# =====================================================

def get_user_by_username(db: Session, username: str) -> Optional[db_models.User]:
    """Get user by username"""
    return db.query(db_models.User).filter(db_models.User.username == username).first()

def get_user_by_email(db: Session, email: str) -> Optional[db_models.User]:
    """Get user by email"""
    return db.query(db_models.User).filter(db_models.User.email == email).first()

def get_user_by_id(db: Session, user_id: str) -> Optional[db_models.User]:
    """Get user by ID"""
    return db.query(db_models.User).filter(db_models.User.id == user_id).first()

def create_user(db: Session, user: schemas.UserCreate, hashed_password: str) -> db_models.User:
    """Create new user with hashed password"""
    db_user = db_models.User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        name=user.name or user.username
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def authenticate_user(db: Session, username: str, password: str):
    """Authenticate user with username and password"""
    from backend.security import verify_password
    
    user = get_user_by_username(db, username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
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
            db_models.File.filename.contains(search)
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

def star_file(db: Session, file_id: str, user_id: str, starred: bool) -> bool:
    """Star/unstar a file"""
    file = get_file_by_id(db, file_id, user_id)
    if file:
        file.is_starred = starred
        db.commit()
        return True
    return False

def pin_file(db: Session, file_id: str, user_id: str, pinned: bool) -> bool:
    """Pin/unpin a file"""
    file = get_file_by_id(db, file_id, user_id)
    if file:
        file.is_pinned = pinned
        db.commit()
        return True
    return False

def get_starred_files(db: Session, user_id: str) -> List[db_models.File]:
    """Get all starred files"""
    return db.query(db_models.File).filter(
        db_models.File.user_id == user_id,
        db_models.File.is_starred == True,
        db_models.File.is_deleted == False
    ).order_by(db_models.File.created_at.desc()).all()
    
def delete_file(db: Session, file_id: str, user_id: str) -> bool:
    """Soft delete a file"""
    file = db.query(db_models.File).filter(
        db_models.File.id == file_id,
        db_models.File.user_id == user_id,
        db_models.File.is_deleted == False
    ).first()
    
    if not file:
        return False
    
    file.is_deleted = True
    db.commit()
    
    return True