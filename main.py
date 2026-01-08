"""
TranscribeFlow (Week 1) - Minimal backend in a single file.

What this file does:
1) Serves the frontend (index.html, app.js) from / using StaticFiles.
2) Provides POST /api/upload endpoint:
   - Accepts an audio file
   - Saves it in /uploads
   - Returns SAMPLE transcript + SAMPLE summary (placeholders for now)

Later, when you add real AI models, you can split this into multiple files (routes/services/etc.).
"""

import os
import uuid
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles

# ----------------------------
# Basic app setup
# ----------------------------

app = FastAPI(title="TranscribeFlow", version="1.0")

# Create folders if not present (safe to call multiple times)
os.makedirs("uploads", exist_ok=True)

# Allowed formats + max size limit
ALLOWED_EXTENSIONS = {".mp3", ".wav"}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB

# ----------------------------
# API endpoints
# ----------------------------

@app.post("/api/upload")
async def upload_audio(file: UploadFile = File(...)):
    """
    Receives an audio file and returns placeholder transcript/summary.
    """

    # 1) Validate extension (basic check)
    _, ext = os.path.splitext(file.filename)
    ext = ext.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file format. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # 2) Validate file size (simple approach: read once)
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 25MB).")

    # IMPORTANT: reset pointer so we can save the file content
    await file.seek(0)

    # 3) Save uploaded file with a unique name to avoid overwriting
    safe_name = f"{uuid.uuid4().hex[:12]}_{file.filename}"
    save_path = os.path.join("uploads", safe_name)

    with open(save_path, "wb") as f:
        f.write(await file.read())

    # 4) Placeholder outputs (Week 1)
    sample_transcript = (
        "This is a sample transcript."
    )
    sample_summary = (
        "This is a sample summary."
    )

    return {
        "filename": file.filename,
        "saved_as": safe_name,
        "transcript": sample_transcript,
        "summary": sample_summary,
        "status": "success",
        "message": "Demo response returned (models will be integrated later)."
    }

@app.get("/api/health")
async def health():
    """Quick endpoint to check if server is running."""
    return {"status": "ok"}

# ----------------------------
# Serve frontend (mount LAST)
# ----------------------------

# Mounting at "/" means:
# - GET / will serve frontend/index.html
# - GET /app.js will serve frontend/app.js
# Must come AFTER /api routes, otherwise it may intercept /api/*.
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
