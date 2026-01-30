from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend import crud
from typing import Optional

def get_current_user(request: Request, db: Session = Depends(get_db)):
    """
    Dependency to get the current logged-in user from session.
    Raises 401 if not authenticated.
    """
    user_id = request.session.get("user_id")
    
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated. Please login."
        )
    
    # Get user from database
    user = db.query(crud.db_models.User).filter(
        crud.db_models.User.id == user_id
    ).first()
    
    if not user:
        # Clear invalid session
        request.session.clear()
        raise HTTPException(
            status_code=401,
            detail="User not found. Please login again."
        )
    
    return user


def get_current_user_optional(request: Request, db: Session = Depends(get_db)):
    """
    Optional authentication - returns user if logged in, None otherwise.
    Does not raise exceptions.
    """
    user_id = request.session.get("user_id")
    
    if not user_id:
        return None
    
    user = db.query(crud.db_models.User).filter(
        crud.db_models.User.id == user_id
    ).first()
    
    return user
