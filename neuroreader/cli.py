"""Command-line interface for NeuroReader."""

import argparse
import asyncio
import sys
import webbrowser
from pathlib import Path

import uvicorn

from . import __version__
from .config import load_config, save_config, get_api_key


def main():
    parser = argparse.ArgumentParser(
        prog="neuroreader",
        description="NeuroReader — Text-to-speech for neurodivergent readers, powered by ElevenLabs.",
    )
    parser.add_argument("--version", action="version", version=f"NeuroReader {__version__}")

    sub = parser.add_subparsers(dest="command")

    # ─── serve ───
    serve_parser = sub.add_parser("serve", help="Start the NeuroReader web server")
    serve_parser.add_argument("--port", type=int, default=None, help="Port number (default: 7729)")
    serve_parser.add_argument("--no-browser", action="store_true", help="Don't open browser automatically")
    serve_parser.add_argument("--no-hotkey", action="store_true", help="Don't start global hotkey listener")

    # ─── speak ───
    speak_parser = sub.add_parser("speak", help="Read text aloud from the command line")
    speak_parser.add_argument("text", nargs="?", help="Text to read (or pipe via stdin)")
    speak_parser.add_argument("--file", "-f", type=str, help="Read text from a file (supports .txt, .pdf)")

    # ─── config ───
    config_parser = sub.add_parser("config", help="View or update configuration")
    config_parser.add_argument("--set-key", type=str, help="Set your ElevenLabs API key")
    config_parser.add_argument("--show", action="store_true", help="Show current configuration")

    args = parser.parse_args()

    if args.command == "serve":
        run_server(args)
    elif args.command == "speak":
        run_speak(args)
    elif args.command == "config":
        run_config(args)
    else:
        parser.print_help()


def run_server(args):
    """Start the NeuroReader web server with optional hotkey listener."""
    config = load_config()
    port = args.port or config.get("port", 7729)

    # Check for API key
    if not get_api_key():
        print("⚠  No ElevenLabs API key configured.")
        print("   Set one with:  neuroreader config --set-key YOUR_KEY")
        print("   Or set the ELEVENLABS_API_KEY environment variable.")
        print("   You can also add it in the web UI Settings tab.\n")

    # Start global hotkey listener
    if not args.no_hotkey:
        try:
            from .hotkey import start_hotkey_listener
            start_hotkey_listener()
        except Exception as e:
            print(f"[NeuroReader] Hotkey listener failed to start: {e}")

    # Open browser
    if not args.no_browser:
        import threading
        def open_browser():
            import time
            time.sleep(1.5)
            webbrowser.open(f"http://127.0.0.1:{port}")
        threading.Thread(target=open_browser, daemon=True).start()

    print(f"\n  ✦ NeuroReader is running at http://127.0.0.1:{port}")
    print(f"  ✦ Press Ctrl+C to stop\n")

    uvicorn.run(
        "neuroreader.server:app",
        host="127.0.0.1",
        port=port,
        log_level="warning",
    )


def run_speak(args):
    """Read text aloud directly from the CLI."""
    from .tts import get_speech_bytes, TTSError
    import tempfile
    import subprocess

    # Resolve text from argument, file, or stdin
    text = None

    if args.file:
        path = Path(args.file)
        if not path.exists():
            print(f"Error: File not found: {args.file}", file=sys.stderr)
            sys.exit(1)

        if path.suffix.lower() == ".pdf":
            from .pdf_reader import extract_text_from_pdf, PDFError
            try:
                text = extract_text_from_pdf(file_path=path)
            except PDFError as e:
                print(f"Error: {e}", file=sys.stderr)
                sys.exit(1)
        else:
            text = path.read_text(encoding="utf-8")
    elif args.text:
        text = args.text
    elif not sys.stdin.isatty():
        text = sys.stdin.read()
    else:
        print("Error: Provide text as an argument, via --file, or pipe via stdin.", file=sys.stderr)
        print("  Example:  neuroreader speak 'Hello world'")
        print("  Example:  echo 'Hello' | neuroreader speak")
        print("  Example:  neuroreader speak --file document.pdf")
        sys.exit(1)

    text = text.strip()
    if not text:
        print("Error: No text to read.", file=sys.stderr)
        sys.exit(1)

    print(f"Reading {len(text)} characters…")

    try:
        audio_bytes = asyncio.run(get_speech_bytes(text))
    except TTSError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    # Write to temp file and play with afplay (macOS)
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name

    try:
        subprocess.run(["afplay", tmp_path], check=True)
    except FileNotFoundError:
        # afplay is macOS-only; fall back to opening with default player
        import platform
        if platform.system() == "Darwin":
            subprocess.run(["open", tmp_path])
        else:
            print(f"Audio saved to: {tmp_path}")
            print("Install a command-line audio player to play directly.")
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def run_config(args):
    """View or update NeuroReader configuration."""
    config = load_config()

    if args.set_key:
        config["elevenlabs_api_key"] = args.set_key
        save_config(config)
        print("✓ API key saved.")
        return

    if args.show:
        key = config.get("elevenlabs_api_key", "")
        masked = key[:4] + "•" * (len(key) - 8) + key[-4:] if len(key) > 8 else "(not set)"
        print(f"  API Key:    {masked}")
        print(f"  Voice ID:   {config.get('voice_id', 'default')}")
        print(f"  Model:      {config.get('model_id', 'default')}")
        print(f"  Speed:      {config.get('speed', 1.0)}×")
        print(f"  Stability:  {config.get('stability', 0.5)}")
        print(f"  Similarity: {config.get('similarity_boost', 0.75)}")
        print(f"  Port:       {config.get('port', 7729)}")
        print(f"  Hotkey:     {config.get('global_hotkey', 'cmd+shift+r')}")
        return

    # Default: show help
    print("Use --show to view config or --set-key to set your API key.")
    print("  neuroreader config --show")
    print("  neuroreader config --set-key sk_xxxxx")


if __name__ == "__main__":
    main()
