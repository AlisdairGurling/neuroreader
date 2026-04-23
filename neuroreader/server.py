"""FastAPI server — the heart of NeuroReader."""

import asyncio
import io
import os
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from .config import load_config, save_config, get_api_key
from .tts import stream_speech, list_voices, TTSError
from .pdf_reader import extract_text_from_pdf, PDFError

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="NeuroReader", version="0.1.0")

BASE_DIR = Path(__file__).resolve().parent.parent
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Serve the main NeuroReader interface."""
    config = load_config()
    has_key = bool(get_api_key())
    return templates.TemplateResponse(
        request,
        "index.html",
        {"has_key": has_key, "config": config},
    )


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------

@app.post("/api/speak")
async def speak(request: Request):
    """Convert text to speech and stream MP3 audio back."""
    body = await request.json()
    text = body.get("text", "").strip()
    voice_id = body.get("voice_id")

    if not text:
        raise HTTPException(status_code=400, detail="No text provided.")

    if len(text) > 50_000:
        raise HTTPException(
            status_code=400,
            detail="Text exceeds 50,000 characters. Please use a shorter selection."
        )

    # Pre-flight check: ensure API key exists before starting the stream
    if not get_api_key():
        raise HTTPException(
            status_code=502,
            detail="No ElevenLabs API key found. Set ELEVENLABS_API_KEY or configure it in Settings.",
        )

    try:
        return StreamingResponse(
            stream_speech(text, voice_id),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=neuroreader.mp3"},
        )
    except TTSError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/api/speak-pdf")
async def speak_pdf(file: UploadFile = File(...)):
    """Extract text from an uploaded PDF and stream it as speech."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF.")

    contents = await file.read()
    if len(contents) > 50 * 1024 * 1024:  # 50 MB limit
        raise HTTPException(status_code=400, detail="PDF exceeds 50 MB size limit.")

    try:
        text = extract_text_from_pdf(file_bytes=contents)
    except PDFError as e:
        raise HTTPException(status_code=422, detail=str(e))

    try:
        return StreamingResponse(
            stream_speech(text),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=neuroreader.mp3"},
        )
    except TTSError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/api/extract-pdf")
async def extract_pdf(file: UploadFile = File(...)):
    """Extract text from a PDF and return it (so the user can review before speaking)."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF.")

    contents = await file.read()
    try:
        text = extract_text_from_pdf(file_bytes=contents)
    except PDFError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return {"text": text, "char_count": len(text)}


@app.get("/api/voices")
async def get_voices():
    """List available ElevenLabs voices."""
    try:
        voices = await list_voices()
        return {"voices": voices}
    except TTSError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/config")
async def get_config():
    """Return current configuration (API key is masked)."""
    config = load_config()
    masked = config.copy()
    key = masked.get("elevenlabs_api_key", "")
    if key:
        masked["elevenlabs_api_key"] = key[:4] + "•" * (len(key) - 8) + key[-4:] if len(key) > 8 else "••••"
    masked["has_key"] = bool(get_api_key())
    return masked


@app.post("/api/config")
async def update_config(request: Request):
    """Update configuration."""
    body = await request.json()
    config = load_config()

    # Only update known keys
    allowed_keys = {
        "elevenlabs_api_key", "voice_id", "model_id",
        "stability", "similarity_boost", "speed", "global_hotkey",
    }
    for key, value in body.items():
        if key in allowed_keys:
            config[key] = value

    save_config(config)
    return {"status": "ok"}


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    has_key = bool(get_api_key())
    return {"status": "ok", "has_api_key": has_key}
