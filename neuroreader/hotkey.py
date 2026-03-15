"""
Global keyboard shortcut listener for NeuroReader.

Provides two integration paths on macOS:
1. Global hotkey (Cmd+Shift+R) — reads clipboard contents aloud
2. macOS Services integration — highlight text anywhere, right-click → Read with NeuroReader

The global hotkey uses pynput to listen for key combinations.
The Services integration is set up by the installer script.
"""

import subprocess
import threading
import sys
import httpx

NEUROREADER_URL = "http://127.0.0.1:7729"


def get_clipboard_text() -> str:
    """Get the current macOS clipboard contents as text."""
    try:
        result = subprocess.run(
            ["pbpaste"], capture_output=True, text=True, timeout=5
        )
        return result.stdout.strip()
    except Exception:
        return ""


def send_to_neuroreader(text: str) -> None:
    """Send text to the NeuroReader server for speech."""
    if not text:
        return
    try:
        httpx.post(
            f"{NEUROREADER_URL}/api/speak",
            json={"text": text},
            timeout=5.0,
        )
    except Exception as e:
        print(f"[NeuroReader] Could not reach server: {e}", file=sys.stderr)


def start_hotkey_listener(hotkey_combo: str = "cmd+shift+r") -> threading.Thread:
    """
    Start a background thread that listens for the global hotkey.

    When triggered, reads clipboard and sends it to the NeuroReader server
    for text-to-speech playback.
    """
    try:
        from pynput import keyboard
    except ImportError:
        print(
            "[NeuroReader] pynput not installed — global hotkey disabled. "
            "Install with: pip install pynput",
            file=sys.stderr,
        )
        return None

    # Parse hotkey combo into pynput key set
    COMBO = {keyboard.Key.cmd, keyboard.Key.shift, keyboard.KeyCode.from_char("r")}
    current_keys = set()

    def on_press(key):
        current_keys.add(key)
        if COMBO.issubset(current_keys):
            text = get_clipboard_text()
            if text:
                print(f"[NeuroReader] Reading {len(text)} chars from clipboard…")
                # Fire and forget in a thread so we don't block the listener
                threading.Thread(target=send_to_neuroreader, args=(text,), daemon=True).start()

    def on_release(key):
        current_keys.discard(key)

    listener = keyboard.Listener(on_press=on_press, on_release=on_release)
    listener.daemon = True
    listener.start()
    print(f"[NeuroReader] Global hotkey active: ⌘⇧R (reads clipboard)")
    return listener
