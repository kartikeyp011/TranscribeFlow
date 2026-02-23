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

# =====================================================
# Constants & Configuration
# =====================================================

STOP_WORDS = {
    'the', 'a', 'an', 'and', 'but', 'or', 'if', 'then', 'else', 'when',
    'at', 'from', 'by', 'on', 'off', 'for', 'in', 'out', 'over', 'to',
    'into', 'with', 'about', 'against', 'between', 'through', 'during',
    'before', 'after', 'above', 'below', 'up', 'down', 'under', 'again',
    'further', 'once', 'here', 'there', 'where', 'why', 'how', 'all',
    'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'd', 'll',
    'm', 'o', 're', 've', 'y', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'but', 'at', 'by',
    'with', 'from', 'here', 'when', 'where', 'how', 'all', 'any', 'both',
    'each', 'few', 'more', 'some', 'such', 'no', 'nor', 'too', 'very',
    'can', 'will', 'just', 'should', 'now'
}

POSITIVE_WORDS = {
    'good', 'great', 'awesome', 'excellent', 'happy', 'love', 'wonderful',
    'best', 'better', 'success', 'successful', 'win', 'winner', 'gain',
    'positive', 'benefit', 'beautiful', 'perfect', 'smart', 'intelligent',
    'easy', 'efficient', 'nice', 'cool', 'amazing', 'fantastic', 'joy',
    'fun', 'exciting', 'glad', 'proud', 'confident', 'optimistic', 'creative',
    'effective', 'productive', 'helpful', 'valuable', 'profitable', 'rewarding'
}

NEGATIVE_WORDS = {
    'bad', 'terrible', 'awful', 'worst', 'worse', 'fail', 'failure',
    'lose', 'loser', 'loss', 'negative', 'problem', 'error', 'issue',
    'mistake', 'wrong', 'difficult', 'inefficient', 'sad', 'hate',
    'anger', 'angry', 'frustrated', 'annoyed', 'upset', 'disappointed',
    'boring', 'useless', 'waste', 'hurt', 'pain', 'danger', 'risk',
    'risky', 'concern', 'worried', 'stress', 'crisis', 'crash', 'broken'
}

# =====================================================
# Content File Management
# =====================================================

CONTENT_DIR = "content_files"
os.makedirs(CONTENT_DIR, exist_ok=True)

def get_content_path(filename: str) -> str:
    """Get absolute path for a content file"""
    return os.path.join(CONTENT_DIR, filename)

def save_content_file(data: dict) -> str:
    """Save content data to a unique JSON file and return the filename"""
    filename = f"{uuid.uuid4()}.json"
    filepath = get_content_path(filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return filename

def read_content_file(filename: str) -> dict:
    """Read content data from a JSON file"""
    if not filename: return {}
    filepath = get_content_path(filename)
    if not os.path.exists(filepath): return {}
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading content file {filename}: {e}")
        return {}

# =====================================================
# Content File Management
# =====================================================



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

# ── Migrate: add duration_seconds column if missing ──────────────
from sqlalchemy import inspect as sa_inspect, text as sa_text
insp = sa_inspect(engine)
if "files" in insp.get_table_names():
    existing_cols = {c["name"] for c in insp.get_columns("files")}
    if "duration_seconds" not in existing_cols:
        with engine.begin() as conn:
            conn.execute(sa_text("ALTER TABLE files ADD COLUMN duration_seconds FLOAT NULL"))
        logger.info("✅ Migrated: added duration_seconds column to files table")
    else:
        logger.info("✅ duration_seconds column already exists")

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
    enable_diarization: str = Form("false"),
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

    # Parse diarization flag from string
    diarization_enabled = enable_diarization.lower() in ('true', '1', 'yes', 'on')
    logger.info(f"🔧 Diarization enabled: {diarization_enabled} (raw value: '{enable_diarization}')")

    # Transcribe
    transcript_result = await run_in_threadpool(pipeline.transcribe, path, language)
    transcript_text = transcript_result["text"]
    word_timestamps = transcript_result["words"]
    transcript_segments = transcript_result.get("segments", [])
    
    logger.info(f"📊 Transcription data: {len(word_timestamps)} words, {len(transcript_segments)} segments, {len(transcript_text)} chars")
    
    # Speaker diarization (optional)
    speaker_segments = []
    formatted_transcript = transcript_text  # Default to plain transcript
    
    if diarization_enabled:
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
            
            # Merge diarization with transcript
            if speaker_segments and len(speaker_segments) > 0:
                # Count unique speakers
                unique_speakers = len(set([s['speaker'] for s in speaker_segments]))
                logger.info(f"👤 Found {unique_speakers} unique speakers")
                
                # Merge with all available transcript data
                speaker_transcript = pipeline.merge_diarization_with_transcript(
                    word_timestamps,
                    speaker_segments,
                    transcript_segments=transcript_segments,
                    full_text=transcript_text
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
    
    # Create content file data
    content_data = {
        "transcript": formatted_transcript,
        "summary": summary,
        "word_timestamps": word_timestamps,
        "speaker_segments": speaker_segments,
    }
    
    # Save content to file (NOT DB)
    content_filename = save_content_file(content_data)

    # Save metadata to database
    db_file = crud.create_file(
        db,
        schemas.FileCreate(
            user_id=current_user.id,
            filename=file.filename,
            saved_as=safe_name,
            file_size_mb=round(len(content) / (1024 * 1024), 2),
            language=language,
            content_file=content_filename,
            audio_url=f"/api/stream/{safe_name}",
        ),
    )

    return {
        "id": db_file.id,
        "filename": file.filename,
        "file_size": len(content),  # ✅ Add file size in bytes
        "size": len(content),  # ✅ Add alias
        "file_size_mb": db_file.file_size_mb,  # ✅ Keep MB version
        "audio_url": db_file.audio_url,
        "transcript": formatted_transcript,  # Return from memory since we just created it
        "summary": summary,
        "language": language,  # ✅ Add language
        "created_at": db_file.created_at.isoformat(),  # ✅ Add timestamp
        "status": "success",
    }

@app.post("/api/upload/batch")
async def batch_upload_audio(
    files: List[UploadFile] = File(...),
    language: str = Form("auto"),
    summary_mode: str = Form("bullet"),
    enable_diarization: str = Form("false"),
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
        
        # Parse diarization flag from string
        diarization_enabled = enable_diarization.lower() in ('true', '1', 'yes', 'on') if isinstance(enable_diarization, str) else bool(enable_diarization)
        
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
            diarization_enabled,
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
def process_audio_file(
    save_path: str,
    safe_name: str,
    filename: str,
    language: str,
    summary_mode: str,
    user_id: str,
    file_size: int,
    enable_diarization = False,
    num_speakers: Optional[int] = None
):
    """Background task to process audio file"""
    from backend.database import SessionLocal
    
    # Ensure enable_diarization is a boolean
    if isinstance(enable_diarization, str):
        enable_diarization = enable_diarization.lower() in ('true', '1', 'yes', 'on')
    
    db = SessionLocal()
    try:
        logger.info(f"🎙️ Processing {filename}...")
        
        # Transcribe
        transcript_result = pipeline.transcribe(save_path, language)
        transcript_text = transcript_result["text"]
        word_timestamps = transcript_result["words"]
        transcript_segments = transcript_result.get("segments", [])
        
        # Speaker diarization (optional)
        speaker_segments = []
        formatted_transcript = transcript_text
        
        if enable_diarization:
            try:
                speaker_segments = pipeline.diarize_speakers(save_path, num_speakers)
                
                if speaker_segments:
                    speaker_transcript = pipeline.merge_diarization_with_transcript(
                        word_timestamps,
                        speaker_segments,
                        transcript_segments=transcript_segments,
                        full_text=transcript_text
                    )
                    formatted_transcript = pipeline.format_transcript_with_speakers(speaker_transcript)
                    
            except Exception as e:
                logger.warning(f"⚠️ Diarization failed for {filename}: {e}")
        
        # Summarize
        summary = pipeline.summarize(formatted_transcript, summary_mode)
        
        # Save to file (NOT DB)
        content_data = {
            "transcript": formatted_transcript,
            "summary": summary,
            "word_timestamps": word_timestamps,
            "speaker_segments": speaker_segments,
        }
        content_filename = save_content_file(content_data)
        
        # Calculate audio duration from transcript segments
        duration_seconds = None
        if transcript_segments:
            duration_seconds = max(seg.get("end", 0) for seg in transcript_segments)
        elif word_timestamps:
            duration_seconds = max(w.get("end", 0) for w in word_timestamps)
        
        # Save to DB
        file_create = schemas.FileCreate(
            user_id=user_id,
            filename=filename,
            saved_as=safe_name,
            file_size_mb=round(file_size / (1024 * 1024), 2),
            language=language,
            content_file=content_filename,
            audio_url=f"/api/stream/{safe_name}",
            duration_seconds=duration_seconds,
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
    include_content: bool = True,
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
            db_models.File.filename.contains(search)
        )
    
    # Sort by pinned first, then by created date
    files = query.order_by(
        db_models.File.is_pinned.desc(),
        db_models.File.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    total = crud.get_user_file_count(db, current_user.id)
    
    # Process files - optimize by skipping content read if not requested
    result_files = []
    
    if include_content:
        # If including content, read synchronously or defer (simple loop here)
        for f in files:
            c_data = read_content_file(f.content_file) if f.content_file else {}
            result_files.append({
                "id": f.id,
                "filename": f.filename,
                "file_size": int(f.file_size_mb * 1024 * 1024) if f.file_size_mb else 0,
                "size": int(f.file_size_mb * 1024 * 1024) if f.file_size_mb else 0,
                "file_size_mb": f.file_size_mb,
                "size_mb": f.file_size_mb,
                "language": f.language,
                "created_at": f.created_at.isoformat(),
                "audio_url": f.audio_url,
                "is_starred": f.is_starred,
                "is_pinned": f.is_pinned,
                "content_file": f.content_file,
                "transcript": c_data.get("transcript"),
                "summary": c_data.get("summary")
            })
    else:
        # Faster path without file I/O
        for f in files:
            result_files.append({
                "id": f.id,
                "filename": f.filename,
                "file_size": int(f.file_size_mb * 1024 * 1024) if f.file_size_mb else 0,
                "size": int(f.file_size_mb * 1024 * 1024) if f.file_size_mb else 0,
                "file_size_mb": f.file_size_mb,
                "size_mb": f.file_size_mb,
                "language": f.language,
                "created_at": f.created_at.isoformat(),
                "audio_url": f.audio_url,
                "is_starred": f.is_starred,
                "is_pinned": f.is_pinned,
                "content_file": f.content_file,
                "transcript": None,
                "summary": None
            })
    
    return {
        "files": result_files,
        "total": total,
        "skip": skip,
        "limit": limit
    }

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
    
    # Read content from file
    transcript = None
    summary = None
    word_timestamps = None
    speaker_segments = None
    
    if file.content_file:
        content = read_content_file(file.content_file)
        transcript = content.get("transcript")
        summary = content.get("summary")
        word_timestamps = json.dumps(content.get("word_timestamps")) if content.get("word_timestamps") else None
        speaker_segments = json.dumps(content.get("speaker_segments")) if content.get("speaker_segments") else None
    
    return {
        "id": file.id,
        "filename": file.filename,
        "file_size": file_size_bytes,
        "size": file_size_bytes,
        "file_size_mb": file.file_size_mb,
        "size_mb": file.file_size_mb,
        "language": file.language,
        "created_at": file.created_at.isoformat(),
        "audio_url": file.audio_url,
        "transcript": transcript,
        "summary": summary,
        "is_starred": file.is_starred,
        "is_pinned": file.is_pinned,
        "word_timestamps": word_timestamps,
        "speaker_segments": speaker_segments,
        "content_file": file.content_file
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
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Star/unstar a file"""
    body = await request.json()
    starred = body.get('starred', False)
    
    success = crud.star_file(db, file_id, current_user.id, starred)
    
    if not success:
        raise HTTPException(404, "File not found")
    
    return {"message": "File starred" if starred else "File unstarred"}

@app.patch("/api/files/{file_id}/pin")
async def pin_file(
    file_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Pin/unpin a file"""
    body = await request.json()
    pinned = body.get('pinned', False)
    
    success = crud.pin_file(db, file_id, current_user.id, pinned)
    
    if not success:
        raise HTTPException(404, "File not found")
    
    return {"message": "File pinned" if pinned else "File unpinned"}

# =====================================================
# Export
# =====================================================

@app.get("/api/files/{file_id}/export")
async def export_file(
    file_id: str,
    format: str,  # txt, pdf, docx, or srt
    content: str = "both",  # transcript, summary, or both
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Export transcript in various formats"""
    file = crud.get_file_by_id(db, file_id, current_user.id)
    
    if not file:
        raise HTTPException(404, "File not found")
    
    format = format.lower()
    content = content.lower()
    
    # Determine what text to export based on content param
    # Load content from file
    transcript_text = ""
    summary_text = ""
    word_timestamps_data = None
    
    if file.content_file:
        content_data = read_content_file(file.content_file)
        transcript_text = content_data.get("transcript") or ""
        summary_text = content_data.get("summary") or ""
        word_timestamps_data = content_data.get("word_timestamps") # List or None

    if content == "transcript":
        # transcript_text already populated
        summary_text = ""
    elif content == "summary":
        transcript_text = ""
        # summary_text already populated
    else:  # both
        # both already populated
        pass
    
    if format == "txt":
        export_content = export_txt(transcript_text, summary_text, file.filename, content)
        media_type = "text/plain"
        extension = "txt"
    elif format == "pdf":
        export_content = export_pdf(transcript_text, summary_text, file.filename, content)
        media_type = "application/pdf"
        extension = "pdf"
    elif format == "docx":
        export_content = export_docx(transcript_text, summary_text, file.filename, content)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        extension = "docx"
    elif format == "srt":
        # Prepare word_timestamps as JSON string/list for export_srt
        wt_input = json.dumps(word_timestamps_data) if word_timestamps_data else "[]"
        export_content = export_srt(wt_input, transcript_text)
        media_type = "application/x-subrip"
        extension = "srt"
    else:
        raise HTTPException(400, "Invalid format. Use: txt, pdf, docx, or srt")
    
    filename = f"{file.filename.rsplit('.', 1)[0]}.{extension}"
    
    return StreamingResponse(
        BytesIO(export_content),
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
# Dashboard Stats
# =====================================================

# Stop words to exclude from keyword extraction
STOP_WORDS = {
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'by','from','is','it','this','that','was','are','were','be','been',
    'being','have','has','had','do','does','did','will','would','could',
    'should','may','might','can','shall','not','no','so','if','then',
    'than','too','very','just','about','above','after','again','all',
    'also','am','any','because','before','between','both','each','few',
    'get','got','here','how','into','its','let','like','make','many',
    'me','more','most','much','my','new','now','only','other','our',
    'out','over','own','same','she','some','such','take','their','them',
    'there','these','they','those','through','under','up','us','we',
    'what','when','where','which','while','who','why','you','your',
    'i','he','her','him','his','able','said','one','two','well','know',
    'say','go','see','come','thing','think','look','want','give','use',
    'find','tell','ask','work','seem','feel','try','leave','call','need',
    'become','keep','put','mean','still','back','turn','long','right',
    'going','really','even','way','good','yeah','okay','yes','um','uh',
    'oh','ah','speaker','would','going','actually','something','people',
    'time','first','last','next','much','little'
}

POSITIVE_WORDS = {
    'good','great','excellent','amazing','wonderful','fantastic','happy',
    'love','best','better','positive','success','successful','benefit',
    'improve','progress','achieve','win','growth','opportunity','agree',
    'pleased','outstanding','brilliant','perfect','nice','awesome',
    'thanks','thank','appreciate','well','exciting','excited','glad',
    'enjoy','helpful','productive','efficient','effective','solved',
}

NEGATIVE_WORDS = {
    'bad','poor','terrible','awful','horrible','wrong','fail','failure',
    'problem','issue','error','negative','worse','worst','difficult',
    'trouble','risk','concern','worried','unfortunately','disagree',
    'unhappy','disappoint','frustrated','frustrating','delay','delayed',
    'lost','miss','missed','broken','stuck','confusing','confused',
    'lack','lacking','unable','cannot','complaint','slow','expensive',
}

@app.get("/api/dashboard/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get dashboard statistics for the current user"""
    from sqlalchemy import func as sqlfunc
    from collections import Counter
    import re

    user_id = current_user.id

    try:
        # ── Base query: all non-deleted files for this user ──────────
        base = db.query(db_models.File).filter(
            db_models.File.user_id == user_id,
            db_models.File.is_deleted == False
        )

        all_files = base.all()
        total_files = len(all_files)

        if total_files == 0:
            return {
                "total_files": 0,
                "total_minutes": 0,
                "avg_duration_min": 0,
                "most_used_language": "—",
                "total_storage_mb": 0,
                "weekly_files": 0,
                "weekly_minutes": 0,
                "files_trend_pct": 0,
                "minutes_trend_pct": 0,
                "quota_pct": 0,
                "common_keywords": [],
                "sentiment": {"positive": 34, "neutral": 33, "negative": 33},
                "productivity_score": 0,
            }

        # ── Backfill duration_seconds for files that don't have it ────
        for f in all_files:
            if f.duration_seconds is None and f.content_file:
                try:
                    c_data = read_content_file(f.content_file)
                    segments = c_data.get("word_timestamps") or []
                    if segments:
                        max_end = max(seg.get("end", 0) for seg in segments)
                        if max_end > 0:
                            f.duration_seconds = max_end
                            db.add(f)
                except Exception:
                    pass  # Skip files with missing/corrupt content
        try:
            db.commit()
        except Exception:
            db.rollback()

        # ── Basic aggregates ─────────────────────────────────────────
        total_storage_mb = sum(f.file_size_mb or 0 for f in all_files)

        # Duration: use duration_seconds if available, else estimate ~1 min per MB
        total_seconds = sum(
            f.duration_seconds if f.duration_seconds else (f.file_size_mb or 0) * 60
            for f in all_files
        )
        total_minutes = round(total_seconds / 60, 1)
        avg_duration_min = round(total_minutes / total_files, 1) if total_files else 0

        # Most used language
        lang_counts = Counter(f.language for f in all_files if f.language)
        most_used_language = lang_counts.most_common(1)[0][0] if lang_counts else "—"

        # ── Weekly stats (last 7 days vs prior 7 days) ───────────────
        now = datetime.utcnow()
        week_ago = now - timedelta(days=7)
        two_weeks_ago = now - timedelta(days=14)

        # After (safe):
        this_week = []
        for f in all_files:
            try:
                if f.created_at:
                    ca = f.created_at.replace(tzinfo=None) if f.created_at.tzinfo else f.created_at
                    if ca >= week_ago:
                        this_week.append(f)
            except Exception:
                pass
            
            last_week = [f for f in all_files if f.created_at and two_weeks_ago <= f.created_at.replace(tzinfo=None) < week_ago]

        weekly_files = len(this_week)
        weekly_seconds = sum(
            f.duration_seconds if f.duration_seconds else (f.file_size_mb or 0) * 60
            for f in this_week
        )
        weekly_minutes = round(weekly_seconds / 60, 1)

        last_week_files = len(last_week)
        last_week_seconds = sum(
            f.duration_seconds if f.duration_seconds else (f.file_size_mb or 0) * 60
            for f in last_week
        )

        # Trend percentages
        files_trend_pct = 0
        if last_week_files > 0:
            files_trend_pct = round(((weekly_files - last_week_files) / last_week_files) * 100)
        elif weekly_files > 0:
            files_trend_pct = 100

        minutes_trend_pct = 0
        if last_week_seconds > 0:
            minutes_trend_pct = round(((weekly_seconds - last_week_seconds) / last_week_seconds) * 100)
        elif weekly_seconds > 0:
            minutes_trend_pct = 100

        # Quota: weekly files as % of total (capped at 100)
        quota_pct = min(round((weekly_files / max(total_files, 1)) * 100), 100)

        # ── Common keywords from recent transcripts ──────────────────
        recent_files = sorted(all_files, key=lambda f: f.created_at or datetime.min, reverse=True)[:20]
        word_counter = Counter()
        for f in recent_files:
            # Read transcript from content file
            f_transcript = None
            if f.content_file:
                try:
                    c_data = read_content_file(f.content_file)
                    f_transcript = c_data.get("transcript")
                except Exception:
                    pass
            
            if f_transcript:
                words = re.findall(r'[a-zA-Z]{3,}', f_transcript.lower())
                word_counter.update(w for w in words if w not in STOP_WORDS)

        common_keywords = [word.title() for word, _ in word_counter.most_common(8)]

        # ── Sentiment heuristic ──────────────────────────────────────
        pos_count = 0
        neg_count = 0
        total_sentiment_words = 0
        for f in recent_files:
            # Read transcript from content file
            f_transcript = None
            if f.content_file:
                try:
                    c_data = read_content_file(f.content_file)
                    f_transcript = c_data.get("transcript")
                except Exception:
                    pass

            if f_transcript:
                words = re.findall(r'[a-zA-Z]{3,}', f_transcript.lower())
                for w in words:
                    if w in POSITIVE_WORDS:
                        pos_count += 1
                        total_sentiment_words += 1
                    elif w in NEGATIVE_WORDS:
                        neg_count += 1
                        total_sentiment_words += 1

        if total_sentiment_words > 0:
            pos_pct = round((pos_count / total_sentiment_words) * 100)
            neg_pct = round((neg_count / total_sentiment_words) * 100)
            neu_pct = 100 - pos_pct - neg_pct
        else:
            pos_pct, neu_pct, neg_pct = 34, 33, 33

        # ── Productivity score ───────────────────────────────────────
        # Composite: base = weekly_files * 10, capped at 100
        # Bonus for streaks (any activity in each of last 7 days?)
        active_days = set()
        for f in this_week:
            if f.created_at:
                active_days.add(f.created_at.replace(tzinfo=None).date())

        streak_bonus = len(active_days) * 5  # up to 35
        base_score = min(weekly_files * 12, 60)
        productivity_score = min(base_score + streak_bonus, 100)

        return {
            "total_files": total_files,
            "total_minutes": total_minutes,
            "avg_duration_min": avg_duration_min,
            "most_used_language": most_used_language.upper(),
            "total_storage_mb": round(total_storage_mb, 1),
            "weekly_files": weekly_files,
            "weekly_minutes": weekly_minutes,
            "files_trend_pct": files_trend_pct,
            "minutes_trend_pct": minutes_trend_pct,
            "quota_pct": quota_pct,
            "common_keywords": common_keywords,
            "sentiment": {
                "positive": pos_pct,
                "neutral": neu_pct,
                "negative": neg_pct,
            },
            "productivity_score": productivity_score,
        }

    except Exception as e:
        logger.error(f"❌ Dashboard stats error: {e}", exc_info=True)
        # Return zeros with error flag so frontend at least knows
        return {
            "total_files": 0,
            "total_minutes": 0,
            "avg_duration_min": 0,
            "most_used_language": "—",
            "total_storage_mb": 0,
            "weekly_files": 0,
            "weekly_minutes": 0,
            "files_trend_pct": 0,
            "minutes_trend_pct": 0,
            "quota_pct": 0,
            "common_keywords": [],
            "sentiment": {"positive": 34, "neutral": 33, "negative": 33},
            "productivity_score": 0,
        }

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

@app.get("/history")
async def serve_history():
    """Serve history (file manager) page"""
    file_path = os.path.join(FRONTEND_DIR, "history.html")
    return FileResponse(file_path)

@app.get("/user")
async def serve_user():
    """Serve user profile page"""
    file_path = os.path.join(FRONTEND_DIR, "user.html")
    return FileResponse(file_path)

# =====================================================
# Maintenance
# =====================================================


