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
    FastAPI dependency that resolves the currently authenticated user.

    The user ID is extracted from the JWT token and then verified
    against the database. Ensures the user exists and the account
    is active before allowing access to protected routes.
    """
    # Fetch user from database using ID extracted from token
    user = crud.get_user_by_id(db, token_user_id)
    
    # If user does not exist, force re-authentication
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found. Please login again."
        )
    
    # Prevent access if account is disabled
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    
    return user


def get_current_user_optional(db: Session = Depends(get_db)):
    """
    Optional authentication dependency.

    Intended for routes where authentication is not mandatory.
    Returns None if the user is not authenticated instead of raising errors.
    """
    try:
        # Imported inside the function to avoid circular dependencies
        from backend.security import oauth2_scheme
        from fastapi import Request
        
        # Token extraction/validation would normally happen here.
        # Currently returns None if authentication is not provided.
        return None
    except:
        # Fail silently for optional authentication
        return None