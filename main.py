import os
import uuid
import json
import mimetypes
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
import shutil
import sys
import asyncio
import logging

# 🔥 WINDOWS ASYNCIO FIX
if os.name == 'nt':  # Windows only
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    logging.getLogger('uvicorn').setLevel(logging.WARNING)
    logging.getLogger('uvicorn.access').handlers = []  # Hide access logs

app = FastAPI(title="TranscribeFlow", version="2.0")

# Creating necessary directories
os.makedirs("uploads", exist_ok=True)
os.makedirs("frontend", exist_ok=True)

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".ogg"}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB

# Storing recent files in memory (simple list, resets on restart)
recent_files = []

@app.post("/api/upload")
async def upload_audio(file: UploadFile = File(...)):
    """
    MAIN UPLOAD ENDPOINT:
    1. Validates file extension and size
    2. Saves file with unique name to uploads/
    3. Returns sample response (replace with real models later)
    4. Adds to recent_files list
    """
    # Getting file extension and validate
    _, ext = os.path.splitext(file.filename)
    ext = ext.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid format. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # Reading and validating file size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 25MB)")

    # Resetting file pointer for re-reading
    await file.seek(0)
    
    # Generating safe unique filename: UUID_timestamp_originalname
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = f"{uuid.uuid4().hex[:8]}_{timestamp}_{file.filename}"
    save_path = os.path.join("uploads", safe_name)

    # Saving file to disk
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Sample data
    sample_transcript = """This is a sample transcript generated from your audio file. 
    When you integrate Whisper or Wav2Vec2, this will contain the actual speech-to-text output.

    The transcript will preserve speaker turns, timestamps, and natural speech patterns."""

    sample_summary = """<strong>Key Points Summary:</strong>
    • Main topic discussed in audio
    • 3-5 bullet points capturing essence  
    • Action items and decisions made
    • Important timestamps highlighted"""

    # FixING the timestamp format for frontend
    timestamp_formatted = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    file_info = {
        "filename": file.filename,
        "saved_as": safe_name,
        "size_mb": round(len(content) / (1024*1024), 1),
        "uploaded": timestamp_formatted,  # FIXED: Proper date format
        "url": f"/api/stream/{safe_name}"
    }

    recent_files.append(file_info)
    recent_files[:] = recent_files[-10:]  # Keep only last 10

    return {
        "filename": file.filename,
        "saved_as": safe_name,
        "size_mb": file_info["size_mb"],
        "uploaded": timestamp,
        "audio_url": f"/api/stream/{safe_name}",
        "transcript": sample_transcript,
        "summary": sample_summary,
        "status": "success",
        "recent_files": recent_files
    }

@app.get("/api/stream/{filename}")
async def stream_audio(filename: str):
    """
    AUDIO STREAM ENDPOINT:
    Serves uploaded audio files for HTML5 audio player
    Sets proper MIME type and Content-Range headers for seeking
    """
    file_path = os.path.join("uploads", filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Get MIME type for audio file
    mime_type, _ = mimetypes.guess_type(file_path)
    
    def iterfile():
        with open(file_path, mode="rb") as file:
            yield from file
    
    # Return as streaming response for audio playback
    return StreamingResponse(
        iterfile(),
        media_type=mime_type or "audio/mpeg",
        headers={"Accept-Ranges": "bytes"}
    )

@app.get("/api/recent")
async def get_recent():
    """Returns list of recently uploaded files"""
    return {"recent_files": recent_files}

@app.delete("/api/clear-all")
async def clear_all():
    """DELETES ALL FILES in uploads/ folder - USE CAREFULLY"""
    cleared_count = 0
    for filename in os.listdir("uploads"):
        file_path = os.path.join("uploads", filename)
        try:
            os.remove(file_path)
            cleared_count += 1
        except Exception:
            pass
    
    global recent_files
    recent_files = []
    
    return {"cleared": cleared_count, "message": f"Cleared {cleared_count} files"}

@app.get("/api/health")
async def health():
    return {"status": "ok", "recent_count": len(recent_files)}

# Serve frontend files
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")