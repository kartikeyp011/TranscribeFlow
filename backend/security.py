import os
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# Load environment variables (JWT secret, algorithm, expiration)
load_dotenv()

# =====================================================
# JWT Configuration
# =====================================================

# Secret key used to sign JWT tokens
SECRET_KEY = os.getenv("JWT_SECRET_KEY")

# Signing algorithm
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# Default token expiration time
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

# OAuth2 helper used by FastAPI to extract Bearer token from requests
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


# =====================================================
# Password Hashing Functions (PBKDF2)
# =====================================================

def hash_password(password: str) -> str:
    """Hash a password using PBKDF2-SHA256 with a random salt."""

    # Generate a secure random salt
    salt = secrets.token_bytes(32)
    
    # Derive password hash
    pwd_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt,
        100000  # number of hashing iterations
    )
    
    # Store salt + hash together (hex encoded)
    return salt.hex() + pwd_hash.hex()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a stored hash."""
    try:
        # Extract original salt from stored value
        salt = bytes.fromhex(hashed_password[:64])
        stored_hash = hashed_password[64:]
        
        # Recompute hash with the same salt
        pwd_hash = hashlib.pbkdf2_hmac(
            'sha256',
            plain_password.encode('utf-8'),
            salt,
            100000
        )
        
        # Compare hashes
        return pwd_hash.hex() == stored_hash

    except Exception as e:
        print(f"Password verification error: {e}")
        return False


# =====================================================
# JWT Token Functions
# =====================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token."""

    to_encode = data.copy()

    # Determine expiration time
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    # Add expiration claim
    to_encode.update({"exp": expire})

    # Generate encoded JWT
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return encoded_jwt


def verify_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload

    except JWTError:
        # Token is invalid or expired
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


# =====================================================
# Token Dependency
# =====================================================

def get_current_user_from_token(token: str = Depends(oauth2_scheme)):
    """
    Extract user ID from JWT token.

    Used as a FastAPI dependency for protected routes.
    """
    payload = verify_token(token)

    # User ID is stored in the 'sub' claim
    user_id: str = payload.get("sub")
    
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user_id