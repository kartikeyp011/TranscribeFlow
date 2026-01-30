import os
import uuid
import mimetypes
import asyncio
import logging
import pathlib  # ✅ ADDED
from pydantic import BaseModel
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    Request,
    Depends,
)

from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, RedirectResponse, HTMLResponse, FileResponse
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from backend.models import pipeline

from starlette.middleware.sessions import SessionMiddleware
from backend.auth import oauth, get_auth0_logout_url
from backend.database import get_db, engine, Base
from backend import db_models, crud, schemas
from backend.dependencies import get_current_user, get_current_user_optional
from sqlalchemy.orm import Session


# =====================================================
# Request Models
# =====================================================

class TranslateRequest(BaseModel):
    text: str
    source_lang: Optional[str] = "auto"
    target_lang: Optional[str] = "en"


class DetectLanguageRequest(BaseModel):
    text: str


# =====================================================
# Logging
# =====================================================

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

active_connections: dict[str, WebSocket] = {}
log_queue: asyncio.Queue = asyncio.Queue()
main_loop: asyncio.AbstractEventLoop | None = None


# =====================================================
# WebSocket Log Handler
# =====================================================

class WebSocketLogHandler(logging.Handler):

    def emit(self, record):
        if record.levelno != logging.INFO or not main_loop:
            return

        try:
            msg = self.format(record)
            main_loop.call_soon_threadsafe(
                log_queue.put_nowait,
                (msg, record.levelname),
            )
        except Exception:
            pass


ws_handler = WebSocketLogHandler()
ws_handler.setFormatter(logging.Formatter("%(name)s: %(message)s"))
logging.getLogger().addHandler(ws_handler)


# =====================================================
# Log Dispatcher
# =====================================================

async def process_log_queue():
    while True:
        msg, level = await log_queue.get()
        dead = []

        for rid, ws in active_connections.items():
            try:
                await ws.send_json({
                    "type": "log",
                    "message": msg,
                    "level": level.lower(),
                    "timestamp": datetime.now().isoformat(),
                })
            except Exception:
                dead.append(rid)

        for rid in dead:
            active_connections.pop(rid, None)


# =====================================================
# Lifespan
# =====================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    global main_loop
    main_loop = asyncio.get_running_loop()
    task = asyncio.create_task(process_log_queue())
    yield
    task.cancel()
    active_connections.clear()


# =====================================================
# App
# =====================================================

app = FastAPI(
    title="TranscribeFlow",
    version="2.2",
    lifespan=lifespan,
)


# =====================================================
# Middleware
# =====================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SECRET_KEY", "your-secret-key-change-this"),
    max_age=86400  # 24 hours
)


# =====================================================
# Storage
# =====================================================

# ✅ FIXED: Use absolute paths
BASE_DIR = pathlib.Path(__file__).parent.parent.resolve()
UPLOAD_DIR = str(BASE_DIR / "uploads")
FRONTEND_DIR = str(BASE_DIR / "frontend")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(FRONTEND_DIR, exist_ok=True)

logger.info(f"📁 Upload directory: {UPLOAD_DIR}")
logger.info(f"📁 Frontend directory: {FRONTEND_DIR}")

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".ogg"}
MAX_FILE_SIZE = 25 * 1024 * 1024
MAX_RECENT = 20

recent_files: list[dict] = []


# =====================================================
# WebSocket
# =====================================================

@app.websocket("/ws/logs/{request_id}")
async def websocket_logs(ws: WebSocket, request_id: str):
    await ws.accept()
    active_connections[request_id] = ws
    logger.info(f"WebSocket connected [{request_id}]")

    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        active_connections.pop(request_id, None)
        logger.info(f"WebSocket disconnected [{request_id}]")


# =====================================================
# Authentication Routes
# =====================================================

@app.get("/login")
async def login(request: Request):
    """Redirect to Auth0 login page"""
    redirect_uri = request.url_for('callback')
    return await oauth.auth0.authorize_redirect(request, redirect_uri)


@app.get("/callback")
async def callback(request: Request, db: Session = Depends(get_db)):
    """Auth0 callback handler"""
    try:
        token = await oauth.auth0.authorize_access_token(request)
        user_info = token.get('userinfo')
        
        if not user_info:
            raise HTTPException(400, "Failed to get user info from Auth0")
        
        auth0_user_id = user_info.get('sub')
        email = user_info.get('email')
        name = user_info.get('name', email)
        picture = user_info.get('picture')
        
        user = crud.get_user_by_auth0_id(db, auth0_user_id)
        
        if not user:
            user_create = schemas.UserCreate(
                auth0_user_id=auth0_user_id,
                email=email,
                name=name,
                picture=picture
            )
            user = crud.create_user(db, user_create)
            logger.info(f"✅ New user created: {email}")
        else:
            logger.info(f"✅ User logged in: {email}")
        
        request.session['user_id'] = user.id
        request.session['user_email'] = user.email
        request.session['user_name'] = user.name
        
        return RedirectResponse(url='/upload.html', status_code=302)
        
    except Exception as e:
        logger.exception("Auth callback failed")
        raise HTTPException(400, f"Authentication failed: {str(e)}")


@app.get("/logout")
async def logout(request: Request):
    """Logout user and redirect to Auth0 logout"""
    request.session.clear()
    logout_url = get_auth0_logout_url(return_to=str(request.base_url))
    logger.info(f"🚪 User logged out, redirecting to: {logout_url}")
    return RedirectResponse(url=logout_url)


@app.get("/api/auth/me")
async def get_current_user_info(
    request: Request,
    current_user = Depends(get_current_user)
):
    """Get current logged-in user info"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "picture": current_user.picture,
        "total_files": current_user.total_files,
        "total_minutes": current_user.total_minutes,
        "created_at": current_user.created_at.isoformat()
    }


@app.get("/api/auth/check")
async def check_auth(request: Request):
    """Check if user is authenticated"""
    user_id = request.session.get("user_id")
    return {
        "authenticated": user_id is not None,
        "user_email": request.session.get("user_email"),
        "user_name": request.session.get("user_name")
    }


# =====================================================
# Upload
# =====================================================

@app.post("/api/upload")
async def upload_audio(
    file: UploadFile = File(...),
    language: str = Form("auto"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    request_id = str(uuid.uuid4())
    logger.info(f"📤 Upload started by {current_user.email} (lang={language})")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Unsupported file format")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large")

    safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    save_path = os.path.join(UPLOAD_DIR, safe_name)

    with open(save_path, "wb") as f:
        f.write(content)

    try:
        logger.info("🎙️ Processing audio...")

        transcript = await run_in_threadpool(
            pipeline.transcribe,
            save_path,
            language
        )

        summary = await run_in_threadpool(
            pipeline.summarize,
            transcript
        )

        logger.info("✅ AI complete")

    except Exception as e:
        logger.exception(f"❌ AI failed: {e}")
        transcript = "Transcription failed"
        summary = "Summary failed"

    file_create = schemas.FileCreate(
        user_id=current_user.id,
        filename=file.filename,
        saved_as=safe_name,
        file_size_mb=round(len(content) / (1024 * 1024), 2),
        language=language,
        transcript=transcript,
        summary=summary,
        audio_url=f"/api/stream/{safe_name}"
    )
    
    db_file = crud.create_file(db, file_create)
    crud.update_user_stats(db, current_user.id, file_count_delta=1)
    
    logger.info(f"💾 File saved to DB: {db_file.id}")

    return {
        "id": db_file.id,
        "filename": file.filename,
        "saved_as": safe_name,
        "size_mb": db_file.file_size_mb,
        "uploaded": db_file.created_at.isoformat(),
        "audio_url": db_file.audio_url,
        "transcript": transcript,
        "summary": summary,
        "language": language,
        "request_id": request_id,
        "status": "success",
    }


# =====================================================
# Stream
# =====================================================

@app.get("/api/stream/{filename}")
async def stream_audio(filename: str):
    path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, "File not found")

    mime, _ = mimetypes.guess_type(path)

    def file_iter():
        with open(path, "rb") as f:
            yield from f

    return StreamingResponse(
        file_iter(),
        media_type=mime or "audio/mpeg",
        headers={"Accept-Ranges": "bytes"},
    )


# =====================================================
# Recent
# =====================================================

@app.get("/api/recent")
async def recent():
    return {"recent_files": recent_files}


# =====================================================
# Detect Language
# =====================================================

@app.post("/api/detect-language")
async def detect_language(req: DetectLanguageRequest):
    result = await run_in_threadpool(
        pipeline.detect_language,
        req.text
    )
    return {
        "status": "success",
        "language": result
    }


# =====================================================
# Translate
# =====================================================

@app.post("/api/translate")
async def translate_text(request: TranslateRequest):
    try:
        src = request.source_lang or "auto"
        tgt = request.target_lang or "en"

        if src == tgt:
            logger.warning("Forcing auto-detect")
            src = "auto"

        logger.info(f"🌐 Translate: {src} -> {tgt}")

        result = await run_in_threadpool(
            pipeline.translate_text,
            request.text,
            src,
            tgt
        )

        return {
            "status": "success",
            **result
        }

    except Exception as e:
        logger.exception("Translation failed")
        raise HTTPException(500, str(e))


# =====================================================
# File Management
# =====================================================

@app.get("/api/files")
async def get_user_files(
    skip: int = 0,
    limit: int = 20,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all files for the current user"""
    files = crud.get_user_files(db, current_user.id, skip, limit, search)
    total = crud.get_user_file_count(db, current_user.id)
    
    return {
        "files": [
            {
                "id": f.id,
                "filename": f.filename,
                "size_mb": f.file_size_mb,
                "language": f.language,
                "created_at": f.created_at.isoformat(),
                "audio_url": f.audio_url
            }
            for f in files
        ],
        "total": total,
        "skip": skip,
        "limit": limit
    }


@app.get("/api/files/{file_id}")
async def get_file_details(
    file_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get specific file details"""
    file = crud.get_file_by_id(db, file_id, current_user.id)
    
    if not file:
        raise HTTPException(404, "File not found")
    
    return {
        "id": file.id,
        "filename": file.filename,
        "saved_as": file.saved_as,
        "size_mb": file.file_size_mb,
        "language": file.language,
        "transcript": file.transcript,
        "summary": file.summary,
        "audio_url": file.audio_url,
        "created_at": file.created_at.isoformat()
    }


@app.delete("/api/files/{file_id}")
async def delete_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete a file"""
    success = crud.delete_file(db, file_id, current_user.id)
    
    if not success:
        raise HTTPException(404, "File not found")
    
    crud.update_user_stats(db, current_user.id, file_count_delta=-1)
    
    return {"message": "File deleted successfully"}


@app.get("/api/stats")
async def get_user_stats(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get user statistics"""
    file_count = crud.get_user_file_count(db, current_user.id)
    
    return {
        "total_files": file_count,
        "total_minutes": current_user.total_minutes,
        "account_created": current_user.created_at.isoformat(),
        "email": current_user.email,
        "name": current_user.name
    }


# =====================================================
# Health
# =====================================================

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "version": "2.2"
    }


# =====================================================
# CORS Preflight
# =====================================================

@app.options("/api/{path:path}")
async def options_handler(request: Request, path: str):
    return {"status": "ok"}


@app.get("/upload")
async def serve_upload_page(request: Request):
    """Serve upload page - requires authentication"""
    user_id = request.session.get("user_id")
    
    if not user_id:
        # Not authenticated - redirect to login
        return RedirectResponse(url='/login', status_code=302)
    
    # Authenticated - serve the page
    file_path = os.path.join(FRONTEND_DIR, "upload.html")
    return FileResponse(file_path)


@app.get("/results")
async def serve_results_page(request: Request):
    """Serve results page - requires authentication"""
    user_id = request.session.get("user_id")
    
    if not user_id:
        # Not authenticated - redirect to login
        return RedirectResponse(url='/login', status_code=302)
    
    # Authenticated - serve the page
    file_path = os.path.join(FRONTEND_DIR, "results.html")
    return FileResponse(file_path)


@app.get("/dashboard")
async def serve_dashboard_page(request: Request):
    """Serve dashboard page - requires authentication"""
    user_id = request.session.get("user_id")
    
    if not user_id:
        # Not authenticated - redirect to login
        return RedirectResponse(url='/login', status_code=302)
    
    # Authenticated - serve the page
    file_path = os.path.join(FRONTEND_DIR, "dashboard.html")
    return FileResponse(file_path)
    
# =====================================================
# Frontend (MUST BE LAST)
# =====================================================

app.mount(
    "/",
    StaticFiles(directory=FRONTEND_DIR, html=True),
    name="frontend"
)