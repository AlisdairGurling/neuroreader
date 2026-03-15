#!/bin/bash
# ─── NeuroReader: One-line installer for macOS ───
# Usage: curl -fsSL https://raw.githubusercontent.com/alisdairgurling/neuroreader/main/scripts/install.sh | bash
#
# What this does:
#   1. Checks for Python 3.10+
#   2. Installs NeuroReader via pip (with global hotkey support)
#   3. Prompts for your ElevenLabs API key
#   4. Optionally installs the macOS right-click Service
#   5. Launches NeuroReader

set -e

# ─── Colours ───
BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo ""
echo -e "${PURPLE}${BOLD}  ✦ NeuroReader Installer${NC}"
echo -e "${DIM}  Text-to-speech for neurodivergent readers${NC}"
echo ""

# ─── Check Python ───
PYTHON=""
if command -v python3 &> /dev/null; then
    PYTHON="python3"
elif command -v python &> /dev/null; then
    PYTHON="python"
fi

if [ -z "$PYTHON" ]; then
    echo -e "${RED}✗ Python not found.${NC}"
    echo "  Install Python 3.10+ from https://python.org or via Homebrew:"
    echo "  brew install python"
    exit 1
fi

# Check version
PY_VERSION=$($PYTHON -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
PY_MAJOR=$($PYTHON -c 'import sys; print(sys.version_info.major)')
PY_MINOR=$($PYTHON -c 'import sys; print(sys.version_info.minor)')

if [ "$PY_MAJOR" -lt 3 ] || ([ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 10 ]); then
    echo -e "${RED}✗ Python $PY_VERSION found, but 3.10+ is required.${NC}"
    echo "  Upgrade with: brew install python"
    exit 1
fi

echo -e "${GREEN}✓${NC} Python $PY_VERSION found"

# ─── Check pip ───
PIP="$PYTHON -m pip"
if ! $PIP --version &> /dev/null; then
    echo -e "${RED}✗ pip not found.${NC}"
    echo "  Install with: $PYTHON -m ensurepip --upgrade"
    exit 1
fi

echo -e "${GREEN}✓${NC} pip available"

# ─── Install NeuroReader ───
echo ""
echo -e "${BOLD}Installing NeuroReader…${NC}"
$PIP install --upgrade "neuroreader[hotkey] @ git+https://github.com/alisdairgurling/neuroreader.git" --quiet 2>&1 | grep -v "WARNING"

if ! command -v neuroreader &> /dev/null; then
    # pip installed to a non-PATH location — try finding it
    NEUROREADER_BIN=$($PYTHON -c "import sysconfig; print(sysconfig.get_path('scripts'))")/neuroreader
    if [ -f "$NEUROREADER_BIN" ]; then
        echo -e "${YELLOW}⚠${NC}  neuroreader was installed to ${DIM}$(dirname $NEUROREADER_BIN)${NC}"
        echo "  Add it to your PATH:"
        echo "  export PATH=\"\$PATH:$(dirname $NEUROREADER_BIN)\""
        echo ""
        export PATH="$PATH:$(dirname $NEUROREADER_BIN)"
    fi
fi

echo -e "${GREEN}✓${NC} NeuroReader installed"

# ─── API Key ───
echo ""
echo -e "${BOLD}ElevenLabs API Key${NC}"
echo -e "${DIM}  Your key is stored locally at ~/.neuroreader/config.json${NC}"
echo -e "${DIM}  Get a free key at: https://elevenlabs.io/app/settings/api-keys${NC}"
echo ""

if [ -n "$ELEVENLABS_API_KEY" ]; then
    echo -e "${GREEN}✓${NC} Found ELEVENLABS_API_KEY in environment"
else
    read -p "  Paste your ElevenLabs API key (or press Enter to skip): " API_KEY
    if [ -n "$API_KEY" ]; then
        neuroreader config --set-key "$API_KEY"
        echo -e "${GREEN}✓${NC} API key saved"
    else
        echo -e "${YELLOW}⚠${NC}  Skipped — you can set it later with:"
        echo "  neuroreader config --set-key YOUR_KEY"
    fi
fi

# ─── macOS Service ───
echo ""
read -p "  Install macOS right-click Service? (y/N): " INSTALL_SERVICE
if [[ "$INSTALL_SERVICE" =~ ^[Yy]$ ]]; then
    # Clone just the script if not already present
    SCRIPT_URL="https://raw.githubusercontent.com/alisdairgurling/neuroreader/main/scripts/install-macos-service.sh"
    curl -fsSL "$SCRIPT_URL" | bash
else
    echo -e "${DIM}  Skipped — you can install it later with:${NC}"
    echo "  bash scripts/install-macos-service.sh"
fi

# ─── Done ───
echo ""
echo -e "${GREEN}${BOLD}  ✦ NeuroReader is ready!${NC}"
echo ""
echo "  Start it with:"
echo -e "  ${BOLD}neuroreader serve${NC}"
echo ""
echo "  Or read text directly:"
echo -e "  ${BOLD}neuroreader speak \"Hello world\"${NC}"
echo ""

# ─── Offer to launch ───
read -p "  Launch NeuroReader now? (Y/n): " LAUNCH
if [[ ! "$LAUNCH" =~ ^[Nn]$ ]]; then
    neuroreader serve
fi
