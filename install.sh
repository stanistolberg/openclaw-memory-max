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
cp -r src package.json README.md "$EXT_DIR"

# 4. Install dependencies blindly
echo "Installing Node.js packages (@xenova/transformers, yaml)..."
cd "$EXT_DIR" || exit
npm install --omit=dev

echo "✅ Installation Complete! Please restart your OpenClaw Daemon / Server to compile the TypeScript extensions."
