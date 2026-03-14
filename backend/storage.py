import os
import json
import boto3
from botocore.client import Config
from dotenv import load_dotenv

load_dotenv()

R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")

R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"


def get_r2_client():
    return boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def upload_audio(file_bytes: bytes, key: str) -> str:
    """Upload raw audio bytes to R2 under audio/{key}. Returns the full R2 object key."""
    r2 = get_r2_client()
    object_key = f"audio/{key}"
    r2.put_object(
        Bucket=R2_BUCKET_NAME,
        Key=object_key,
        Body=file_bytes,
    )
    return object_key


def upload_content(data: dict, key: str) -> str:
    """Serialize dict as JSON and upload to R2 under content/{key}. Returns the full R2 object key."""
    r2 = get_r2_client()
    object_key = f"content/{key}"
    body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
    r2.put_object(
        Bucket=R2_BUCKET_NAME,
        Key=object_key,
        Body=body,
        ContentType="application/json",
    )
    return object_key


def download_content(key: str) -> dict:
    """Download and parse a JSON content file from R2. Returns empty dict on failure."""
    if not key:
        return {}
    try:
        r2 = get_r2_client()
        response = r2.get_object(Bucket=R2_BUCKET_NAME, Key=key)
        body = response["Body"].read()
        return json.loads(body.decode("utf-8"))
    except Exception as e:
        print(f"[storage] Failed to download content key={key}: {e}")
        return {}


def get_presigned_audio_url(key: str, expires_in: int = 3600) -> str:
    """Generate a presigned URL for an audio object in R2. Default expiry is 1 hour."""
    try:
        r2 = get_r2_client()
        url = r2.generate_presigned_url(
            "get_object",
            Params={"Bucket": R2_BUCKET_NAME, "Key": key},
            ExpiresIn=expires_in,
        )
        return url
    except Exception as e:
        print(f"[storage] Failed to generate presigned URL for key={key}: {e}")
        return ""


def delete_object(key: str) -> bool:
    """Delete an object from R2 by its full key. Returns True on success."""
    if not key:
        return False
    try:
        r2 = get_r2_client()
        r2.delete_object(Bucket=R2_BUCKET_NAME, Key=key)
        return True
    except Exception as e:
        print(f"[storage] Failed to delete key={key}: {e}")
        return False