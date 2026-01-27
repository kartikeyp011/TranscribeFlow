import os
import uuid
import mimetypes
import asyncio
import logging
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    Request,
)

from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from models import pipeline


# ---------------------------
# Request/Response Models
# ---------------------------
class TranslateRequest(BaseModel):
    text: str
    source_lang: str = 'auto'
    target_lang: str = 'en'

class DetectLanguageRequest(BaseModel):
    text: str


# ---------------------------
# Logging Setup
# ---------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

active_connections: dict[str, WebSocket] = {}
log_queue: asyncio.Queue = asyncio.Queue()
main_loop: asyncio.AbstractEventLoop | None = None

# ---------------------------
# WebSocket Log Handler
# ---------------------------
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

# ---------------------------
# Background Log Dispatcher
# ---------------------------
async def process_log_queue():
    while True:
        msg, level = await log_queue.get()
        dead = []
        for rid, ws in active_connections.items():
            try:
                await ws.send_json(
                    {
                        "type": "log",
                        "message": msg,
                        "level": level.lower(),
                        "timestamp": datetime.now().isoformat(),
                    }
                )
            except Exception:
                dead.append(rid)

        for rid in dead:
            active_connections.pop(rid, None)


# ---------------------------
# Lifespan
# ---------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global main_loop
    main_loop = asyncio.get_running_loop()
    log_task = asyncio.create_task(process_log_queue())
    yield
    log_task.cancel()
    active_connections.clear()


app = FastAPI(
    title="TranscribeFlow",
    version="2.1",
    lifespan=lifespan,
)

# ---------------------------
# Middleware
# ---------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------
# Storage
# ---------------------------
UPLOAD_DIR = "uploads"
FRONTEND_DIR = "frontend"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(FRONTEND_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".ogg"}
MAX_FILE_SIZE = 25 * 1024 * 1024
MAX_RECENT = 20

recent_files: list[dict] = []

# ---------------------------
# WebSocket Logs
# ---------------------------
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


# ---------------------------
# Upload & AI Processing
# ---------------------------
@app.post("/api/upload")
async def upload_audio(
    file: UploadFile = File(...),
    language: str = Form("en")
):
    request_id = str(uuid.uuid4())
    logger.info(f"Upload started (Language: {language})")

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
        logger.info(f"🌐 Processing audio with language: {language}")
        
        result = await run_in_threadpool(
            pipeline.transcribe, save_path, language
        )
        transcript = result.get('text', result) if isinstance(result, dict) else result
        
        summary = await run_in_threadpool(
            pipeline.summarize, transcript
        )
        logger.info("✅ AI processing complete")
    except Exception as e:
        logger.exception("AI processing failed")
        transcript = "Transcription failed"
        summary = "Summary failed"

    record = {
        "filename": file.filename,
        "saved_as": safe_name,
        "size_mb": round(len(content) / (1024 * 1024), 2),
        "uploaded": datetime.now().isoformat(),
        "audio_url": f"/api/stream/{safe_name}",
        "transcript": transcript,
        "summary": summary,
        "language": language,
    }

    recent_files.insert(0, record)
    del recent_files[MAX_RECENT:]

    return {
        **record,
        "request_id": request_id,
        "status": "success",
    }


# ---------------------------
# Audio Streaming
# ---------------------------
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


# ---------------------------
# Recent Uploads
# ---------------------------
@app.get("/api/recent")
async def recent():
    return {"recent_files": recent_files}


# ---------------------------
# Get Single File Data (NEW)
# ---------------------------
@app.get("/api/file/{filename}")
async def get_file_data(filename: str):
    """
    Get data for a specific file (useful if user refreshes results page)
    """
    for record in recent_files:
        if record.get("saved_as") == filename or record.get("filename") == filename:
            return {
                "status": "success",
                "data": record
            }
    
    raise HTTPException(404, "File not found in recent uploads")


# ---------------------------
# Clear Uploads
# ---------------------------
@app.delete("/api/clear-all")
async def clear_all():
    count = 0
    for f in os.listdir(UPLOAD_DIR):
        try:
            os.remove(os.path.join(UPLOAD_DIR, f))
            count += 1
        except Exception:
            pass
    recent_files.clear()
    return {"cleared": count}


# ---------------------------
# Language Detection
# ---------------------------
@app.post("/api/detect-language")
async def detect_language(request: DetectLanguageRequest):
    try:
        result = await run_in_threadpool(
            pipeline.detect_language, request.text
        )
        return {
            "status": "success",
            "language": result
        }
    except Exception as e:
        logger.exception("Language detection failed")
        raise HTTPException(500, f"Language detection failed: {str(e)}")


# ---------------------------
# Translation
# ---------------------------
@app.post("/api/translate")
async def translate_text(request: TranslateRequest):
    try:
        logger.info(f"Translation request: {request.source_lang} -> {request.target_lang}")
        
        result = await run_in_threadpool(
            pipeline.translate_text,
            request.text,
            request.source_lang,
            request.target_lang
        )
        
        return {
            "status": "success",
            **result
        }
    except Exception as e:
        logger.exception("Translation failed")
        raise HTTPException(500, f"Translation failed: {str(e)}")


# ---------------------------
# Health Check
# ---------------------------
@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.1"}


# ---------------------------
# CORS Preflight Handler (NEW)
# ---------------------------
@app.options("/api/{path:path}")
async def options_handler(request: Request, path: str):
    """Handle OPTIONS requests for CORS"""
    return {"status": "ok"}


# ---------------------------
# Frontend Static Files
# ---------------------------
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
