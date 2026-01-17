# main.py - Fixed async blocking + safe AI execution + WebSocket support

import os
import uuid
import json
import mimetypes
import asyncio
import logging
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool
from contextlib import asynccontextmanager
from models import pipeline
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Store active WebSocket connections and processing logs
active_connections = {}
processing_logs = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    active_connections.clear()
    processing_logs.clear()

app = FastAPI(title="TranscribeFlow", version="2.1", lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create necessary directories
os.makedirs("uploads", exist_ok=True)
os.makedirs("frontend", exist_ok=True)

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".ogg"}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB

# Store recent files (in-memory)
recent_files = []

# ---------------------------
# WebSocket for live logs
# ---------------------------
@app.websocket("/ws/logs/{request_id}")
async def websocket_logs(websocket: WebSocket, request_id: str):
    await websocket.accept()
    active_connections[request_id] = websocket

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        active_connections.pop(request_id, None)


# ---------------------------
# Upload & AI Processing
# ---------------------------
@app.post("/api/upload")
async def upload_audio(file: UploadFile = File(...)):
    logger.info("🚀 /api/upload endpoint HIT")
    request_id = str(uuid.uuid4())
    timestamp = datetime.now().isoformat()

    _, ext = os.path.splitext(file.filename)
    ext = ext.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid format. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 25MB)")

    safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    save_path = os.path.join("uploads", safe_name)

    with open(save_path, "wb") as f:
        f.write(content)

    logger.info(f"🎙️ Processing {file.filename}...")

    try:
        # Run AI in background thread (prevents server hang)
        transcript = await run_in_threadpool(pipeline.transcribe, content)
        summary = await run_in_threadpool(pipeline.summarize, transcript)

        logger.info("✅ Processing complete!")

    except Exception as e:
        logger.error(f"AI Processing failed: {e}")
        transcript = "Transcription failed."
        summary = "Summary generation failed."

    recent_files.insert(0, {
        "filename": file.filename,
        "saved_as": safe_name,
        "size_mb": round(len(content) / (1024 * 1024), 1),
        "uploaded": timestamp,
        "audio_url": f"/api/stream/{safe_name}"
    })

    return {
        "filename": file.filename,
        "saved_as": safe_name,
        "size_mb": round(len(content) / (1024 * 1024), 1),
        "uploaded": timestamp,
        "audio_url": f"/api/stream/{safe_name}",
        "transcript": transcript,
        "summary": summary,
        "status": "success",
        "request_id": request_id
    }


# ---------------------------
# Audio Streaming
# ---------------------------
@app.get("/api/stream/{filename}")
async def stream_audio(filename: str):
    file_path = os.path.join("uploads", filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    mime_type, _ = mimetypes.guess_type(file_path)

    def iterfile():
        with open(file_path, mode="rb") as file:
            yield from file

    return StreamingResponse(
        iterfile(),
        media_type=mime_type or "audio/mpeg",
        headers={"Accept-Ranges": "bytes"}
    )


# ---------------------------
# Recent uploads
# ---------------------------
@app.get("/api/recent")
async def get_recent():
    return {"recent_files": recent_files}


# ---------------------------
# Clear uploads
# ---------------------------
@app.delete("/api/clear-all")
async def clear_all():
    cleared_count = 0
    for filename in os.listdir("uploads"):
        try:
            os.remove(os.path.join("uploads", filename))
            cleared_count += 1
        except Exception:
            pass

    recent_files.clear()
    return {"cleared": cleared_count}


@app.get("/api/health")
async def health():
    return {"status": "ok", "recent_count": len(recent_files)}

# ---------------------------
# Serve Frontend
# ---------------------------
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
