# main.py - Corrected & Production-Safe

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
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from models import pipeline

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
async def upload_audio(file: UploadFile = File(...)):
    request_id = str(uuid.uuid4())
    logger.info("Upload started")

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
        transcript = await run_in_threadpool(
            pipeline.transcribe, save_path
        )
        summary = await run_in_threadpool(
            pipeline.summarize, transcript
        )
        logger.info("AI processing complete")
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
    }

    recent_files.insert(0, record)
    del recent_files[MAX_RECENT:]

    return {
        **record,
        "transcript": transcript,
        "summary": summary,
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


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ---------------------------
# Frontend
# ---------------------------
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
