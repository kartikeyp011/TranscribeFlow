# Imports and standard libraries
import os
import uuid
import mimetypes
import asyncio
import logging
import pathlib
import json
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from typing import Optional, List
from io import BytesIO

# FastAPI and related imports
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
    BackgroundTasks,
    status
)
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, RedirectResponse, FileResponse
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

# Backend application modules
from backend.models import pipeline
from backend.database import get_db
from backend import crud, schemas
from backend.dependencies import get_current_user
from backend.export import export_txt, export_pdf, export_docx, export_srt
from backend.security import (
    hash_password,
    verify_password,
    create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from backend.schemas import UserCreate, UserLogin, Token

from sqlalchemy.orm import Session
from pydantic import BaseModel

# Request model for translation
class TranslateRequest(BaseModel):
    text: str
    source_lang: Optional[str] = "auto"
    target_lang: Optional[str] = "en"

# Request model for language detection
class DetectLanguageRequest(BaseModel):
    text: str

# Configure application logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Store active websocket connections
active_connections: dict[str, WebSocket] = {}

# Queue used to send logs to websockets
log_queue: asyncio.Queue = asyncio.Queue()

# Store main event loop reference
main_loop: asyncio.AbstractEventLoop | None = None

# Custom logging handler that forwards logs to websockets
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

# Register websocket log handler
ws_handler = WebSocketLogHandler()
ws_handler.setFormatter(logging.Formatter("%(name)s: %(message)s"))
logging.getLogger().addHandler(ws_handler)

# Background task that sends logs to all websocket clients
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

# Application lifespan handler
@asynccontextmanager
async def lifespan(app: FastAPI):
    global main_loop
    main_loop = asyncio.get_running_loop()
    task = asyncio.create_task(process_log_queue())
    yield
    task.cancel()
    active_connections.clear()

# Create Database Tables on Startup
from backend.database import engine, Base
from backend import db_models  # Import models so they're registered

# Create all tables
Base.metadata.create_all(bind=engine)
logger.info("✅ Database tables created/verified")

# Create FastAPI app
app = FastAPI(
    title="TranscribeFlow",
    version="2.2",
    lifespan=lifespan,
)

# Enable CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Resolve base directories
BASE_DIR = pathlib.Path(__file__).parent.parent.resolve()
UPLOAD_DIR = str(BASE_DIR / "uploads")
FRONTEND_DIR = str(BASE_DIR / "frontend")
STATIC_DIR = BASE_DIR / "frontend" / "static"

# Ensure required folders exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(FRONTEND_DIR, exist_ok=True)

# File validation settings
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".ogg"}
MAX_FILE_SIZE = 25 * 1024 * 1024

# Serve static assets (CSS, JS, images)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# WebSocket endpoint for live logs
@app.websocket("/ws/logs/{request_id}")
async def websocket_logs(ws: WebSocket, request_id: str):
    await ws.accept()
    active_connections[request_id] = ws
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        active_connections.pop(request_id, None)

# =====================================================
# Authentication Routes
# =====================================================

@app.post("/api/auth/register", response_model=schemas.UserResponse, status_code=201)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    
    # Check if username already exists
    db_user = crud.get_user_by_username(db, user.username)
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="Username already registered"
        )
    
    # Check if email already exists
    db_user = crud.get_user_by_email(db, user.email)
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    # Hash password
    hashed_password = hash_password(user.password)
    
    # Create user
    new_user = crud.create_user(db, user, hashed_password)
    
    logger.info(f"✅ New user registered: {user.username}")
    
    return new_user

@app.post("/api/auth/login", response_model=Token)
async def login(user_credentials: UserLogin, db: Session = Depends(get_db)):
    """Login and get access token"""
    
    # Authenticate user
    user = crud.authenticate_user(db, user_credentials.username, user_credentials.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=access_token_expires
    )
    
    logger.info(f"✅ User logged in: {user.username}")
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

@app.get("/api/auth/me", response_model=schemas.UserResponse)
async def get_current_user_info(current_user = Depends(get_current_user)):
    """Get current logged-in user info"""
    return current_user

@app.post("/api/auth/logout")
async def logout():
    """Logout (client should delete token)"""
    return {"message": "Successfully logged out. Please delete your token."}

# =====================================================
# File Upload & Processing
# =====================================================

@app.post("/api/upload")
async def upload_audio(
    file: UploadFile = File(...),
    language: str = Form("auto"),
    summary_mode: str = Form("bullet"),
    enable_diarization: bool = Form(False),
    num_speakers: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Upload and process audio file"""
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Unsupported file type")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large")

    safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    path = os.path.join(UPLOAD_DIR, safe_name)

    with open(path, "wb") as f:
        f.write(content)

    # Transcribe
    transcript_result = await run_in_threadpool(pipeline.transcribe, path, language)
    transcript_text = transcript_result["text"]
    word_timestamps = transcript_result["words"]
    
    # Speaker diarization (optional)
    speaker_segments = []
    formatted_transcript = transcript_text  # Default to plain transcript
    
    if enable_diarization:
        try:
            logger.info("🎤 Running speaker diarization...")
            logger.info(f"📂 Audio file: {path}")
            logger.info(f"👥 Expected speakers: {num_speakers if num_speakers else 'Auto-detect'}")
            
            # Run diarization and wait for completion
            speaker_segments = await run_in_threadpool(
                pipeline.diarize_speakers,
                path,
                num_speakers
            )
            
            # Log what we got back
            logger.info(f"🔍 Diarization returned {len(speaker_segments) if speaker_segments else 0} segments")
            
            # ✅ Merge diarization with transcript
            if speaker_segments and len(speaker_segments) > 0:
                logger.info(f"📊 Processing {len(speaker_segments)} speaker segments...")
                
                # Count unique speakers
                unique_speakers = len(set([s['speaker'] for s in speaker_segments]))
                logger.info(f"👤 Found {unique_speakers} unique speakers")
                
                # Merge with word timestamps
                speaker_transcript = pipeline.merge_diarization_with_transcript(
                    word_timestamps,
                    speaker_segments
                )
                
                logger.info(f"📝 Created {len(speaker_transcript)} speaker turns")
                
                # Format for display
                formatted_transcript = pipeline.format_transcript_with_speakers(speaker_transcript)
                
                logger.info(f"✅ Diarization complete! Transcript formatted with {unique_speakers} speakers")
            else:
                logger.warning("⚠️ No speaker segments returned from diarization")
                logger.warning("⚠️ Using original transcript without speaker labels")
            
        except Exception as e:
            logger.error(f"❌ Diarization failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            logger.warning("⚠️ Continuing with original transcript")
    
    # Summarize (use the formatted transcript if diarization was used)
    summary = await run_in_threadpool(pipeline.summarize, formatted_transcript, summary_mode)
    
    # Save to database
    db_file = crud.create_file(
        db,
        schemas.FileCreate(
            user_id=current_user.id,
            filename=file.filename,
            saved_as=safe_name,
            file_size_mb=round(len(content) / (1024 * 1024), 2),
            language=language,
            transcript=formatted_transcript,  # ✅ Use formatted transcript
            summary=summary,
            audio_url=f"/api/stream/{safe_name}",
            word_timestamps=json.dumps(word_timestamps),
            speaker_segments=json.dumps(speaker_segments) if speaker_segments else None
        ),
    )

    return {
        "id": db_file.id,
        "filename": file.filename,
        "file_size": len(content),  # ✅ Add file size in bytes
        "size": len(content),  # ✅ Add alias
        "file_size_mb": db_file.file_size_mb,  # ✅ Keep MB version
        "audio_url": db_file.audio_url,
        "transcript": db_file.transcript,
        "summary": db_file.summary,
        "language": language,  # ✅ Add language
        "created_at": db_file.created_at.isoformat(),  # ✅ Add timestamp
        "status": "success",
    }

@app.post("/api/upload/batch")
async def batch_upload_audio(
    files: List[UploadFile] = File(...),
    language: str = Form("auto"),
    summary_mode: str = Form("bullet"),
    enable_diarization: bool = Form(False),
    num_speakers: Optional[int] = Form(None),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Upload multiple files and process them in background"""
    
    if len(files) > 10:
        raise HTTPException(400, "Maximum 10 files per batch")
    
    batch_id = str(uuid.uuid4())
    results = []
    
    for idx, file in enumerate(files):
        request_id = f"{batch_id}_{idx}"
        logger.info(f"📤 Batch upload {idx+1}/{len(files)}: {file.filename}")
        
        # Validate file
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            results.append({
                "filename": file.filename,
                "status": "error",
                "error": "Unsupported file format"
            })
            continue
        
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            results.append({
                "filename": file.filename,
                "status": "error",
                "error": "File too large"
            })
            continue
        
        # Save file
        safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
        save_path = os.path.join(UPLOAD_DIR, safe_name)
        
        with open(save_path, "wb") as f:
            f.write(content)
        
        # Process in background
        background_tasks.add_task(
            process_audio_file,
            save_path,
            safe_name,
            file.filename,
            language,
            summary_mode,
            current_user.id,
            len(content),
            enable_diarization,
            num_speakers
        )
        
        results.append({
            "filename": file.filename,
            "status": "processing",
            "request_id": request_id
        })
    
    return {
        "batch_id": batch_id,
        "total_files": len(files),
        "results": results
    }

# Background processing function
async def process_audio_file(
    save_path: str,
    safe_name: str,
    filename: str,
    language: str,
    summary_mode: str,
    user_id: str,
    file_size: int,
    enable_diarization: bool = False,
    num_speakers: Optional[int] = None
):
    """Background task to process audio file"""
    from backend.database import SessionLocal
    
    db = SessionLocal()
    try:
        logger.info(f"🎙️ Processing {filename}...")
        
        # Transcribe
        transcript_result = pipeline.transcribe(save_path, language)
        transcript_text = transcript_result["text"]
        word_timestamps = transcript_result["words"]
        
        # Speaker diarization (optional)
        speaker_segments = []
        formatted_transcript = transcript_text
        
        if enable_diarization:
            try:
                # ✅ FIXED: Changed to diarize_speakers
                speaker_segments = pipeline.diarize_speakers(save_path, num_speakers)
                
                if speaker_segments:
                    speaker_transcript = pipeline.merge_diarization_with_transcript(
                        word_timestamps,
                        speaker_segments
                    )
                    formatted_transcript = pipeline.format_transcript_with_speakers(speaker_transcript)
                    
            except Exception as e:
                logger.warning(f"⚠️ Diarization failed for {filename}: {e}")
        
        # Summarize
        summary = pipeline.summarize(formatted_transcript, summary_mode)
        
        # Save to DB
        file_create = schemas.FileCreate(
            user_id=user_id,
            filename=filename,
            saved_as=safe_name,
            file_size_mb=round(file_size / (1024 * 1024), 2),
            language=language,
            transcript=formatted_transcript,
            summary=summary,
            audio_url=f"/api/stream/{safe_name}",
            word_timestamps=json.dumps(word_timestamps),
            speaker_segments=json.dumps(speaker_segments) if speaker_segments else None
        )
        
        db_file = crud.create_file(db, file_create)
        
        logger.info(f"✅ Completed: {filename}")
    
    except Exception as e:
        logger.error(f"❌ Failed {filename}: {e}")
    
    finally:
        db.close()

# =====================================================
# Audio Streaming
# =====================================================

@app.get("/api/stream/{filename}")
async def stream_audio(filename: str, request: Request):
    """Stream audio file with Range support for seeking"""
    path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, "File not found")

    file_size = os.path.getsize(path)
    mime, _ = mimetypes.guess_type(path)
    mime = mime or "audio/mpeg"

    # Get Range header
    range_header = request.headers.get("range")

    if not range_header:
        # No range requested, send entire file
        def iterator():
            with open(path, "rb") as f:
                yield from f

        return StreamingResponse(
            iterator(),
            media_type=mime,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
            }
        )

    # Parse range header (format: "bytes=start-end")
    try:
        range_str = range_header.replace("bytes=", "")
        range_parts = range_str.split("-")
        
        start = int(range_parts[0]) if range_parts[0] else 0
        end = int(range_parts[1]) if range_parts[1] else file_size - 1
        
        # Validate range
        if start >= file_size or end >= file_size or start > end:
            raise HTTPException(416, "Range Not Satisfiable")
        
        content_length = end - start + 1

        def ranged_iterator():
            with open(path, "rb") as f:
                f.seek(start)
                remaining = content_length
                chunk_size = 8192
                
                while remaining > 0:
                    chunk = f.read(min(chunk_size, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        return StreamingResponse(
            ranged_iterator(),
            status_code=206,  # Partial Content
            media_type=mime,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
            }
        )
    
    except (ValueError, IndexError):
        raise HTTPException(400, "Invalid Range header")

# =====================================================
# Translation & Language Detection
# =====================================================

@app.post("/api/detect-language")
async def detect_language(req: DetectLanguageRequest):
    """Detect language of text"""
    lang = await run_in_threadpool(pipeline.detect_language, req.text)
    return {"language": lang}

@app.post("/api/translate")
async def translate_text(req: TranslateRequest):
    """Translate text between languages"""
    result = await run_in_threadpool(
        pipeline.translate_text,
        req.text,
        req.source_lang,
        req.target_lang,
    )
    return {"status": "success", **result}

# =====================================================
# File Management
# =====================================================

@app.get("/api/files")
async def get_user_files(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all files for the current user with pinned files first"""
    query = db.query(db_models.File).filter(
        db_models.File.user_id == current_user.id,
        db_models.File.is_deleted == False
    )
    
    if search:
        query = query.filter(
            db_models.File.filename.contains(search) |
            db_models.File.transcript.contains(search)
        )
    
    # Sort by pinned first, then by created date
    files = query.order_by(
        db_models.File.is_pinned.desc(),
        db_models.File.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    total = crud.get_user_file_count(db, current_user.id)
    
    return {
        "files": [
            {
                "id": f.id,
                "filename": f.filename,
                "file_size": int(f.file_size_mb * 1024 * 1024) if f.file_size_mb else 0,  # ✅ Add in bytes
                "size": int(f.file_size_mb * 1024 * 1024) if f.file_size_mb else 0,  # ✅ Add alias
                "file_size_mb": f.file_size_mb,
                "size_mb": f.file_size_mb,  # ✅ Add alias
                "language": f.language,
                "created_at": f.created_at.isoformat(),
                "audio_url": f.audio_url,
                "transcript": f.transcript,
                "summary": f.summary,
                "is_starred": f.is_starred,
                "is_pinned": f.is_pinned
            }
            for f in files
        ],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@app.get("/api/files/{file_id}")
async def get_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get a single file by ID"""
    file = crud.get_file_by_id(db, file_id, current_user.id)
    
    if not file:
        raise HTTPException(404, "File not found")
    
    # Calculate file size in bytes from MB
    file_size_bytes = int(file.file_size_mb * 1024 * 1024) if file.file_size_mb else 0
    
    return {
        "id": file.id,
        "filename": file.filename,
        "file_size": file_size_bytes,  # ✅ Add this - in bytes
        "size": file_size_bytes,  # ✅ Add this alias
        "file_size_mb": file.file_size_mb,  # Keep for backwards compatibility
        "size_mb": file.file_size_mb,  # ✅ Add this alias
        "language": file.language,
        "created_at": file.created_at.isoformat(),
        "audio_url": file.audio_url,
        "transcript": file.transcript,
        "summary": file.summary,
        "is_starred": file.is_starred,
        "is_pinned": file.is_pinned,
        "word_timestamps": file.word_timestamps,
        "speaker_segments": file.speaker_segments
    }

@app.delete("/api/files/{file_id}")
async def delete_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete a file (soft delete)"""
    success = crud.delete_file(db, file_id, current_user.id)
    
    if not success:
        raise HTTPException(404, "File not found")
    
    return {"message": "File deleted successfully"}

@app.patch("/api/files/{file_id}/star")
async def star_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Star/unstar a file"""
    from pydantic import BaseModel
    
    class StarRequest(BaseModel):
        starred: bool
    
    # Get request body
    request = await Request.json()
    starred = request.get('starred', False)
    
    success = crud.star_file(db, file_id, current_user.id, starred)
    
    if not success:
        raise HTTPException(404, "File not found")
    
    return {"message": "File starred" if starred else "File unstarred"}

@app.patch("/api/files/{file_id}/pin")
async def pin_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Pin/unpin a file"""
    from pydantic import BaseModel
    
    class PinRequest(BaseModel):
        pinned: bool
    
    # Get request body
    request = await Request.json()
    pinned = request.get('pinned', False)
    
    success = crud.pin_file(db, file_id, current_user.id, pinned)
    
    if not success:
        raise HTTPException(404, "File not found")
    
    return {"message": "File pinned" if pinned else "File unpinned"}

@app.get("/api/files/starred")
async def get_starred_files(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all starred files"""
    files = crud.get_starred_files(db, current_user.id)
    
    return {
        "files": [
            {
                "id": f.id,
                "filename": f.filename,
                "is_starred": f.is_starred,
                "is_pinned": f.is_pinned,
                "created_at": f.created_at.isoformat()
            }
            for f in files
        ]
    }

# =====================================================
# Export
# =====================================================

@app.get("/api/files/{file_id}/export")
async def export_file(
    file_id: str,
    format: str,  # txt, pdf, docx, or srt
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Export transcript in various formats"""
    file = crud.get_file_by_id(db, file_id, current_user.id)
    
    if not file:
        raise HTTPException(404, "File not found")
    
    format = format.lower()
    
    if format == "txt":
        content = export_txt(file.transcript, file.summary, file.filename)
        media_type = "text/plain"
        extension = "txt"
    elif format == "pdf":
        content = export_pdf(file.transcript, file.summary, file.filename)
        media_type = "application/pdf"
        extension = "pdf"
    elif format == "docx":
        content = export_docx(file.transcript, file.summary, file.filename)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        extension = "docx"
    elif format == "srt":
        content = export_srt(file.word_timestamps or "[]", file.transcript)
        media_type = "application/x-subrip"
        extension = "srt"
    else:
        raise HTTPException(400, "Invalid format. Use: txt, pdf, docx, or srt")
    
    filename = f"{file.filename.rsplit('.', 1)[0]}.{extension}"
    
    return StreamingResponse(
        BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# =====================================================
# Health Check
# =====================================================

@app.get("/api/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok", "version": "2.2"}

# =====================================================
# Frontend Routes (No Auth Check)
# =====================================================

@app.get("/")
async def serve_index():
    """Serve landing page"""
    file_path = os.path.join(FRONTEND_DIR, "index.html")
    return FileResponse(file_path)

@app.get("/login")
async def serve_login():
    """Serve login page"""
    file_path = os.path.join(FRONTEND_DIR, "login.html")
    return FileResponse(file_path)

@app.get("/register")
async def serve_register():
    """Serve registration page"""
    file_path = os.path.join(FRONTEND_DIR, "register.html")
    return FileResponse(file_path)

@app.get("/upload")
async def serve_upload():
    """Serve upload page"""
    file_path = os.path.join(FRONTEND_DIR, "upload.html")
    return FileResponse(file_path)

@app.get("/dashboard")
async def serve_dashboard():
    """Serve dashboard page"""
    file_path = os.path.join(FRONTEND_DIR, "dashboard.html")
    return FileResponse(file_path)

@app.get("/results")
async def serve_results():
    """Serve results page"""
    file_path = os.path.join(FRONTEND_DIR, "results.html")
    return FileResponse(file_path)