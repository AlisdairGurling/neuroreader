"""ElevenLabs text-to-speech integration."""

import httpx
import asyncio
from typing import AsyncGenerator

from .config import get_api_key, load_config

ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1"


class TTSError(Exception):
    """Raised when text-to-speech fails."""
    pass


async def stream_speech(text: str, voice_id: str | None = None) -> AsyncGenerator[bytes, None]:
    """
    Stream audio bytes from ElevenLabs TTS API.

    Yields chunks of MP3 audio data as they arrive,
    enabling playback to begin before the full response is received.
    """
    api_key = get_api_key()
    if not api_key:
        raise TTSError(
            "No ElevenLabs API key found. "
            "Set ELEVENLABS_API_KEY or configure it in Settings."
        )

    config = load_config()
    voice = voice_id or config["voice_id"]
    model = config["model_id"]

    url = f"{ELEVENLABS_API_BASE}/text-to-speech/{voice}/stream"

    payload = {
        "text": text,
        "model_id": model,
        "voice_settings": {
            "stability": config["stability"],
            "similarity_boost": config["similarity_boost"],
            "speed": config["speed"],
        },
    }

    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream("POST", url, json=payload, headers=headers) as response:
            if response.status_code == 401:
                raise TTSError("Invalid API key. Check your ElevenLabs API key in Settings.")
            if response.status_code == 429:
                raise TTSError("Rate limit exceeded. Please wait a moment and try again.")
            if response.status_code != 200:
                body = await response.aread()
                raise TTSError(f"ElevenLabs API error ({response.status_code}): {body.decode()}")
            async for chunk in response.aiter_bytes(chunk_size=4096):
                yield chunk


async def get_speech_bytes(text: str, voice_id: str | None = None) -> bytes:
    """Get complete audio bytes for a text string."""
    chunks = []
    async for chunk in stream_speech(text, voice_id):
        chunks.append(chunk)
    return b"".join(chunks)


async def list_voices() -> list[dict]:
    """Fetch available voices from the ElevenLabs API."""
    api_key = get_api_key()
    if not api_key:
        raise TTSError("No API key configured.")

    headers = {"xi-api-key": api_key}

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(f"{ELEVENLABS_API_BASE}/voices", headers=headers)
        if resp.status_code != 200:
            raise TTSError(f"Failed to fetch voices: {resp.status_code}")
        data = resp.json()
        return [
            {
                "voice_id": v["voice_id"],
                "name": v["name"],
                "category": v.get("category", "unknown"),
                "description": v.get("labels", {}),
            }
            for v in data.get("voices", [])
        ]
