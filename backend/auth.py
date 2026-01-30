import os
from authlib.integrations.starlette_client import OAuth
from dotenv import load_dotenv

load_dotenv()

# Auth0 Configuration
AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_CLIENT_ID = os.getenv("AUTH0_CLIENT_ID")
AUTH0_CLIENT_SECRET = os.getenv("AUTH0_CLIENT_SECRET")
AUTH0_CALLBACK_URL = os.getenv("AUTH0_CALLBACK_URL", "http://localhost:8000/callback")

# Validate configuration
if not all([AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET]):
    raise ValueError("Missing Auth0 configuration. Check your .env file.")

# OAuth instance
oauth = OAuth()

oauth.register(
    name='auth0',
    client_id=AUTH0_CLIENT_ID,
    client_secret=AUTH0_CLIENT_SECRET,
    server_metadata_url=f'https://{AUTH0_DOMAIN}/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid profile email',
    }
)


def get_auth0_authorize_url(redirect_uri: str) -> str:
    """Generate Auth0 authorization URL"""
    return f"https://{AUTH0_DOMAIN}/authorize?" \
           f"response_type=code&" \
           f"client_id={AUTH0_CLIENT_ID}&" \
           f"redirect_uri={redirect_uri}&" \
           f"scope=openid%20profile%20email"


def get_auth0_logout_url(return_to: str) -> str:
    """Generate Auth0 logout URL"""
    return f"https://{AUTH0_DOMAIN}/v2/logout?" \
           f"client_id={AUTH0_CLIENT_ID}&" \
           f"returnTo={return_to}"
