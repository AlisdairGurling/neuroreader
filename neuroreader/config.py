"""Configuration management for NeuroReader."""

import os
import json
from pathlib import Path

CONFIG_DIR = Path.home() / ".neuroreader"
CONFIG_FILE = CONFIG_DIR / "config.json"

DEFAULT_CONFIG = {
    "elevenlabs_api_key": "",
    "voice_id": "21m00Tcm4TlvDq8ikWAM",  # ElevenLabs "Rachel" — clear, natural reading voice
    "model_id": "eleven_multilingual_v2",
    "stability": 0.5,
    "similarity_boost": 0.75,
    "speed": 1.0,
    "port": 7729,
    "global_hotkey": "cmd+shift+r",
}


def load_config() -> dict:
    """Load configuration from disk, creating defaults if needed."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, "r") as f:
            stored = json.load(f)
        # Merge with defaults so new keys are always present
        merged = {**DEFAULT_CONFIG, **stored}
        return merged
    else:
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG.copy()


def save_config(config: dict) -> None:
    """Persist configuration to disk."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)


def get_api_key() -> str:
    """Resolve API key from config file or environment variable."""
    env_key = os.environ.get("ELEVENLABS_API_KEY", "")
    if env_key:
        return env_key
    config = load_config()
    return config.get("elevenlabs_api_key", "")
