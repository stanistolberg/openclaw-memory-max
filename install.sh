#!/bin/bash
echo "🦞 Installing openclaw-memory-max..."

# 1. Ensure the user has OpenClaw running globally
if ! command -v openclaw &> /dev/null
then
    echo "Error: 'openclaw' CLI could not be found. Please install OpenClaw globally first."
    exit
fi

# 2. Get the expected OpenClaw Extension directory
EXT_DIR="${HOME}/.openclaw/extensions/openclaw-memory-max"

# 3. Copy directory contents to the internal config tree
mkdir -p "$EXT_DIR"
cp -r src tsconfig.json package.json openclaw.plugin.json README.md "$EXT_DIR"

# 4. Install dependencies and build
echo "Installing Node.js packages..."
cd "$EXT_DIR" || exit
npm install
npm run build

echo "✅ Installation Complete! Please restart your OpenClaw Daemon / Server to load the extension."
