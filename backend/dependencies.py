from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend import crud
from backend.security import get_current_user_from_token

def get_current_user(
    token_user_id: str = Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """
    Dependency to get the current logged-in user from JWT token.
    Raises 401 if not authenticated or user not found.
    """
    user = crud.get_user_by_id(db, token_user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found. Please login again."
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    
    return user

def get_current_user_optional(db: Session = Depends(get_db)):
    """
    Optional authentication - returns None if not authenticated.
    Does not raise exceptions.
    """
    try:
        from backend.security import oauth2_scheme
        from fastapi import Request
        
        # This is simplified - in practice you'd need to extract token
        return None
    except:
        return None