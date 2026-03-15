#!/bin/bash
# ─── NeuroReader: macOS Service Installer ───
# Registers NeuroReader as a macOS Service so you can highlight text
# anywhere, right-click → Services → "Read with NeuroReader".
#
# You can then assign a keyboard shortcut in:
#   System Settings → Keyboard → Keyboard Shortcuts → Services

set -e

SERVICE_NAME="Read with NeuroReader"
WORKFLOW_DIR="$HOME/Library/Services"
WORKFLOW_PATH="$WORKFLOW_DIR/${SERVICE_NAME}.workflow"

echo "Installing macOS Service: ${SERVICE_NAME}"

mkdir -p "$WORKFLOW_DIR"
mkdir -p "$WORKFLOW_PATH/Contents"

# Create the Automator workflow Info.plist
cat > "$WORKFLOW_PATH/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSServices</key>
    <array>
        <dict>
            <key>NSMenuItem</key>
            <dict>
                <key>default</key>
                <string>Read with NeuroReader</string>
            </dict>
            <key>NSMessage</key>
            <string>runWorkflowAsService</string>
            <key>NSSendTypes</key>
            <array>
                <string>NSStringPboardType</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
PLIST

# Create the workflow document
cat > "$WORKFLOW_PATH/Contents/document.wflow" << 'WORKFLOW'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>AMApplicationBuild</key>
    <string>523</string>
    <key>AMApplicationVersion</key>
    <string>2.10</string>
    <key>AMDocumentVersion</key>
    <string>2</string>
    <key>actions</key>
    <array>
        <dict>
            <key>action</key>
            <dict>
                <key>AMAccepts</key>
                <dict>
                    <key>Container</key>
                    <string>List</string>
                    <key>Optional</key>
                    <true/>
                    <key>Types</key>
                    <array>
                        <string>com.apple.cocoa.string</string>
                    </array>
                </dict>
                <key>AMActionVersion</key>
                <string>2.0.3</string>
                <key>AMApplication</key>
                <array>
                    <string>Automator</string>
                </array>
                <key>AMCategory</key>
                <array>
                    <string>AMCategoryUtilities</string>
                </array>
                <key>AMIconName</key>
                <string>Automator</string>
                <key>AMParameterProperties</key>
                <dict>
                    <key>COMMAND_STRING</key>
                    <dict/>
                    <key>CheckedForUserDefaultShell</key>
                    <dict/>
                    <key>inputMethod</key>
                    <dict/>
                    <key>shell</key>
                    <dict/>
                    <key>source</key>
                    <dict/>
                </dict>
                <key>AMProvides</key>
                <dict>
                    <key>Container</key>
                    <string>List</string>
                    <key>Types</key>
                    <array>
                        <string>com.apple.cocoa.string</string>
                    </array>
                </dict>
                <key>ActionBundlePath</key>
                <string>/System/Library/Automator/Run Shell Script.action</string>
                <key>ActionName</key>
                <string>Run Shell Script</string>
                <key>ActionParameters</key>
                <dict>
                    <key>COMMAND_STRING</key>
                    <string>curl -s -X POST http://127.0.0.1:7729/api/speak \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"$(cat | sed 's/"/\\"/g' | tr '\n' ' ')\"}" \
  --output /tmp/neuroreader_service.mp3 \
  &amp;&amp; afplay /tmp/neuroreader_service.mp3 \
  &amp;&amp; rm -f /tmp/neuroreader_service.mp3</string>
                    <key>CheckedForUserDefaultShell</key>
                    <true/>
                    <key>inputMethod</key>
                    <integer>0</integer>
                    <key>shell</key>
                    <string>/bin/bash</string>
                    <key>source</key>
                    <string></string>
                </dict>
                <key>BundleIdentifier</key>
                <string>com.apple.RunShellScript</string>
                <key>CFBundleVersion</key>
                <string>2.0.3</string>
                <key>CanShowSelectedItemsWhenRun</key>
                <false/>
                <key>CanShowWhenRun</key>
                <true/>
                <key>Category</key>
                <array>
                    <string>AMCategoryUtilities</string>
                </array>
                <key>Class Name</key>
                <string>RunShellScriptAction</string>
                <key>InputUUID</key>
                <string>1A2B3C4D-5E6F-7890-ABCD-EF1234567890</string>
                <key>Keywords</key>
                <array>
                    <string>Shell</string>
                    <string>Script</string>
                    <string>Command</string>
                    <string>Run</string>
                </array>
                <key>OutputUUID</key>
                <string>0A1B2C3D-4E5F-6789-0ABC-DEF123456789</string>
                <key>UUID</key>
                <string>AABBCCDD-EEFF-0011-2233-445566778899</string>
                <key>UnlocalizedApplications</key>
                <array>
                    <string>Automator</string>
                </array>
            </dict>
        </dict>
    </array>
    <key>connectors</key>
    <dict/>
    <key>workflowMetaData</key>
    <dict>
        <key>serviceInputTypeIdentifier</key>
        <string>com.apple.Automator.text</string>
        <key>serviceProcessesInput</key>
        <integer>0</integer>
        <key>workflowTypeIdentifier</key>
        <string>com.apple.Automator.servicesMenu</string>
    </dict>
</dict>
</plist>
WORKFLOW

# Refresh the Services menu
/System/Library/CoreServices/pbs -flush 2>/dev/null || true

echo ""
echo "✓ Service installed: ${SERVICE_NAME}"
echo ""
echo "To assign a keyboard shortcut:"
echo "  1. Open System Settings → Keyboard → Keyboard Shortcuts → Services"
echo "  2. Find 'Read with NeuroReader' under Text"
echo "  3. Click 'Add Shortcut' and press your preferred keys"
echo ""
echo "Note: NeuroReader server must be running (neuroreader serve) for the service to work."
