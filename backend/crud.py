from sqlalchemy.orm import Session
from backend import db_models, schemas
from typing import List, Optional

# =====================================================
# USER OPERATIONS
# =====================================================

def get_user_by_username(db: Session, username: str) -> Optional[db_models.User]:
    """
    Fetch a user from the database using their username.

    Returns the first matching User object or None if no user exists.
    """
    # Query the users table and filter by username
    return db.query(db_models.User).filter(db_models.User.username == username).first()

def get_user_by_email(db: Session, email: str) -> Optional[db_models.User]:
    """
    Fetch a user from the database using their email address.

    Returns the first matching User object or None if not found.
    """
    # Query the users table and filter by email
    return db.query(db_models.User).filter(db_models.User.email == email).first()

def get_user_by_id(db: Session, user_id: str) -> Optional[db_models.User]:
    """
    Retrieve a user by their unique ID.

    Used internally when performing updates or authorization checks.
    """
    # Query the users table using the primary key
    return db.query(db_models.User).filter(db_models.User.id == user_id).first()

def create_user(db: Session, user: schemas.UserCreate, hashed_password: str) -> db_models.User:
    """
    Create and persist a new user in the database.

    Passwords are never stored in plain text — the hashed password
    is generated in the security layer before being passed here.
    """
    # Create SQLAlchemy model instance from validated schema data
    db_user = db_models.User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        # If name is not provided, default to username
        name=user.name or user.username
    )

    # Add the user to the session and persist to the database
    db.add(db_user)
    db.commit()

    # Refresh instance so generated fields (e.g., ID, timestamps) are available
    db.refresh(db_user)
    return db_user

def authenticate_user(db: Session, username: str, password: str):
    """
    Authenticate a user using username and password.

    Steps:
    1. Fetch user by username
    2. Verify password using the security utility
    3. Return the user object if valid, otherwise False
    """
    from backend.security import verify_password
    
    # Attempt to locate the user
    user = get_user_by_username(db, username)
    if not user:
        return False

    # Verify the provided password against the stored hashed password
    if not verify_password(password, user.hashed_password):
        return False

    return user

def update_user_username(db: Session, user_id: str, new_username: str) -> Optional[db_models.User]:
    """
    Update the username of an existing user.

    Returns the updated user object or None if the user does not exist.
    """
    user = get_user_by_id(db, user_id)
    if not user:
        return None

    # Update username field
    user.username = new_username

    # Persist changes
    db.commit()
    db.refresh(user)
    return user

def update_user_password(db: Session, user_id: str, new_hashed_password: str) -> Optional[db_models.User]:
    """
    Update a user's password.

    The password must already be hashed before being passed to this function.
    """
    user = get_user_by_id(db, user_id)
    if not user:
        return None

    # Replace stored password hash
    user.hashed_password = new_hashed_password

    # Commit changes to the database
    db.commit()
    db.refresh(user)
    return user


# =====================
# FILE OPERATIONS
# =====================

def create_file(db: Session, file: schemas.FileCreate) -> db_models.File:
    """
    Create a new file record associated with a user.

    This typically occurs after a successful file upload.
    """
    # Convert Pydantic schema to SQLAlchemy model
    db_file = db_models.File(**file.dict())

    # Persist the file metadata
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
    """
    Retrieve files belonging to a specific user.

    Supports:
    - Pagination via skip and limit
    - Optional filename search
    - Excludes soft-deleted files
    """
    # Base query: fetch files owned by the user and not deleted
    query = db.query(db_models.File).filter(
        db_models.File.user_id == user_id,
        db_models.File.is_deleted == False
    )
    
    # Apply filename search if provided
    if search:
        query = query.filter(
            db_models.File.filename.contains(search)
        )
    
    # Return newest files first
    return query.order_by(db_models.File.created_at.desc()).offset(skip).limit(limit).all()

def get_file_by_id(db: Session, file_id: str, user_id: str) -> Optional[db_models.File]:
    """
    Fetch a specific file by its ID.

    Ensures the file belongs to the requesting user and is not deleted.
    This acts as an authorization safeguard.
    """
    return db.query(db_models.File).filter(
        db_models.File.id == file_id,
        db_models.File.user_id == user_id,
        db_models.File.is_deleted == False
    ).first()

def delete_file(db: Session, file_id: str, user_id: str) -> bool:
    """
    Soft delete a file.

    Instead of removing the row from the database, the file is marked
    as deleted. This allows recovery and preserves historical data.
    """
    file = get_file_by_id(db, file_id, user_id)
    if file:
        # Mark file as deleted instead of physically removing it
        file.is_deleted = True
        db.commit()
        return True
    return False

def get_user_file_count(db: Session, user_id: str) -> int:
    """
    Return the total number of active (non-deleted) files for a user.

    Used for dashboards, usage metrics, and pagination.
    """
    return db.query(db_models.File).filter(
        db_models.File.user_id == user_id,
        db_models.File.is_deleted == False
    ).count()

def star_file(db: Session, file_id: str, user_id: str, starred: bool) -> bool:
    """
    Mark or unmark a file as starred.

    Starred files are typically used for quick access or favorites.
    """
    file = get_file_by_id(db, file_id, user_id)
    if file:
        file.is_starred = starred
        db.commit()
        return True
    return False

def pin_file(db: Session, file_id: str, user_id: str, pinned: bool) -> bool:
    """
    Pin or unpin a file.

    Pinned files usually appear at the top of the user's dashboard
    for quick visibility.
    """
    file = get_file_by_id(db, file_id, user_id)
    if file:
        file.is_pinned = pinned
        db.commit()
        return True
    return False

def get_starred_files(db: Session, user_id: str) -> List[db_models.File]:
    """
    Retrieve all starred files for a user.

    Results are ordered by creation date (most recent first).
    """
    return db.query(db_models.File).filter(
        db_models.File.user_id == user_id,
        db_models.File.is_starred == True,
        db_models.File.is_deleted == False
    ).order_by(db_models.File.created_at.desc()).all()
    
def delete_file(db: Session, file_id: str, user_id: str) -> bool:
    """
    Soft delete a file (alternative implementation).

    Performs the query directly instead of calling get_file_by_id.
    """
    # Retrieve file ensuring ownership and that it is not already deleted
    file = db.query(db_models.File).filter(
        db_models.File.id == file_id,
        db_models.File.user_id == user_id,
        db_models.File.is_deleted == False
    ).first()
    
    # If file does not exist, return False
    if not file:
        return False
    
    # Mark file as deleted
    file.is_deleted = True
    db.commit()
    
    return True