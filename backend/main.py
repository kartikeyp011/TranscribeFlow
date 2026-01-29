import os
import uuid
import mimetypes
import asyncio
import logging

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
)

from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel

from backend.models import pipeline


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
ws_handler.setFormatter(
    logging.Formatter("%(name)s: %(message)s")
)

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


# =====================================================
# Storage
# =====================================================

UPLOAD_DIR = "../uploads"
FRONTEND_DIR = "../frontend"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(FRONTEND_DIR, exist_ok=True)

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
# Upload
# =====================================================

@app.post("/api/upload")
async def upload_audio(
    file: UploadFile = File(...),
    language: str = Form("auto")   # ✅ AUTO by default
):

    request_id = str(uuid.uuid4())

    logger.info(f"Upload started (lang={language})")


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

        logger.info("Processing audio...")

        transcript = await run_in_threadpool(
            pipeline.transcribe,
            save_path,
            language
        )


        summary = await run_in_threadpool(
            pipeline.summarize,
            transcript
        )


        logger.info("AI complete")


    except Exception:

        logger.exception("AI failed")

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



# =====================================================
# Stream
# =====================================================

@app.get("/api/stream/{filename}")
async def stream_audio(filename: str):

    path = os.path.join(UPLOAD_DIR, filename)

    if not os.path.exists(path):
        raise HTTPException(404, "Not found")


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
# Translate (FIXED)
# =====================================================

@app.post("/api/translate")
async def translate_text(request: TranslateRequest):

    try:

        src = request.source_lang or "auto"
        tgt = request.target_lang or "en"


        # 🔥 SAFETY: prevent en->en bug
        if src == tgt:
            logger.warning("Forcing auto-detect")
            src = "auto"


        logger.info(f"Translate: {src} -> {tgt}")


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



# =====================================================
# Frontend
# =====================================================

app.mount(
    "/",
    StaticFiles(directory=FRONTEND_DIR, html=True),
    name="frontend"
)
