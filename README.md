# NeuroReader

**Text-to-speech for neurodivergent readers, powered by ElevenLabs.**

NeuroReader is an open-source assistive tool that lets you hear any text read aloud — paste it in, drop a PDF, or highlight text anywhere on your Mac and trigger it with a keyboard shortcut. It runs locally, respects your privacy, and you bring your own ElevenLabs API key.

Built by and for neurodivergent people. Framed from a strengths-based, Social Model of Disability perspective: the barrier isn't you — it's inaccessible text. NeuroReader removes that barrier.

---

## Features

- **Paste & listen** — Type or paste text into the web UI and hear it read aloud with natural-sounding voices
- **PDF reading** — Drop a PDF file and NeuroReader extracts the text and reads it to you
- **Global shortcut** — Highlight text anywhere on your Mac, press ⌘⇧R, and hear it instantly
- **macOS Services** — Right-click highlighted text → Services → "Read with NeuroReader"
- **Voice selection** — Choose from all available ElevenLabs voices
- **Speed control** — Adjust playback speed from 0.5× to 2.0×
- **CLI mode** — Read text directly from the terminal: `neuroreader speak "Hello world"`
- **Privacy-first** — Runs locally. Your API key stays on your machine.

### Planned for v2
- Word-by-word highlighting synchronised with audio playback
- OCR support for scanned PDFs
- Browser extension for in-page reading
- Windows and Linux support

---

## Quick Start (macOS)

### One-line install

```bash
curl -fsSL https://raw.githubusercontent.com/alisdairgurling/neuroreader/main/scripts/install.sh | bash
```

This checks for Python, installs NeuroReader, prompts for your ElevenLabs API key, and offers to launch it. That's it.

### Prerequisites
- **Python 3.10+** — Check with `python3 --version`
- **An ElevenLabs API key** — Free tier available at [elevenlabs.io](https://elevenlabs.io)

### Manual install

If you prefer to do it step by step:

```bash
# Install NeuroReader (with global hotkey support)
pip install "neuroreader[hotkey] @ git+https://github.com/alisdairgurling/neuroreader.git"

# Set your API key
neuroreader config --set-key sk_your_elevenlabs_key_here

# Launch
neuroreader serve
```

Or clone and install locally:

```bash
git clone https://github.com/alisdairgurling/neuroreader.git
cd neuroreader
pip install ".[hotkey]"
neuroreader config --set-key sk_your_elevenlabs_key_here
neuroreader serve
```

This opens NeuroReader in your browser at `http://127.0.0.1:7729`. Paste text, drop a PDF, or adjust settings — it's all there.

### CLI usage

```bash
# Read text directly
neuroreader speak "The quick brown fox jumps over the lazy dog"

# Read a file
neuroreader speak --file document.pdf
neuroreader speak --file notes.txt

# Pipe text
echo "Hello world" | neuroreader speak

# View your config
neuroreader config --show
```

---

## macOS Services (right-click to read)

To add a "Read with NeuroReader" option to your right-click menu:

```bash
bash scripts/install-macos-service.sh
```

Then assign a keyboard shortcut:
1. Open **System Settings → Keyboard → Keyboard Shortcuts → Services**
2. Find **"Read with NeuroReader"** under Text
3. Click **Add Shortcut** and press your preferred keys

> **Note:** The NeuroReader server must be running (`neuroreader serve`) for the service to work.

---

## Global Hotkey (⌘⇧R)

When running `neuroreader serve`, the global hotkey listener is active by default:

1. **Highlight text** anywhere (browser, PDF viewer, email, etc.)
2. **Copy it** to clipboard (⌘C)
3. **Press ⌘⇧R** — NeuroReader reads it aloud

This requires the `pynput` library and macOS Accessibility permissions. Install with:

```bash
pip install "neuroreader[hotkey]"
```

You may need to grant Accessibility access to your terminal app in **System Settings → Privacy & Security → Accessibility**.

---

## Configuration

NeuroReader stores its configuration in `~/.neuroreader/config.json`. You can edit settings through the web UI or the CLI:

| Setting | Default | Description |
|---------|---------|-------------|
| `elevenlabs_api_key` | — | Your ElevenLabs API key |
| `voice_id` | `21m00Tcm4TlvDq8ikWAM` | ElevenLabs voice ID (Rachel) |
| `model_id` | `eleven_multilingual_v2` | ElevenLabs model |
| `stability` | `0.5` | Voice stability (0–1) |
| `similarity_boost` | `0.75` | Voice clarity/similarity (0–1) |
| `speed` | `1.0` | Playback speed (0.5–2.0) |
| `port` | `7729` | Local server port |

---

## Project Structure

```
neuroreader/
├── neuroreader/
│   ├── __init__.py       # Package metadata
│   ├── cli.py            # Command-line interface
│   ├── config.py         # Configuration management
│   ├── hotkey.py         # Global keyboard shortcut listener
│   ├── pdf_reader.py     # PDF text extraction
│   ├── server.py         # FastAPI web server
│   └── tts.py            # ElevenLabs API integration
├── static/
│   ├── css/style.css     # UI stylesheet
│   └── js/app.js         # Frontend application
├── templates/
│   └── index.html        # Web UI template
├── scripts/
│   └── install-macos-service.sh  # macOS Service installer
├── pyproject.toml        # Python package configuration
├── LICENSE               # MIT License
└── README.md
```

---

## Why "NeuroReader"?

Because reading should work with your mind, not against it. If the written word creates a barrier, the answer isn't to work harder at decoding — it's to change the medium. NeuroReader is a digital prosthetic: it extends your cognitive toolkit so you can engage with text on your own terms.

---

## Contributing

Contributions are welcome. This project is built with accessibility and neurodivergent users at its centre — please keep that in mind when proposing changes.

```bash
# Development install
git clone https://github.com/alisdairgurling/neuroreader.git
cd neuroreader
pip install -e ".[dev,hotkey]"

# Run linter
ruff check neuroreader/

# Run tests
pytest
```

---

## Licence

MIT — see [LICENSE](LICENSE).

---

## Acknowledgements

- [ElevenLabs](https://elevenlabs.io) for their text-to-speech API
- Built as part of the *Digital Prosthetics: Neurodiversity and the Connected Mind* research project at [Wonderlab, Monash University](https://www.monash.edu/design)
