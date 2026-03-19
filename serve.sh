#!/usr/bin/env bash
# Simple static server for local testing (works in Git Bash / WSL / macOS / Linux)
# Usage: ./serve.sh [port]
PORT=${1:-8000}
echo "Serving site at http://127.0.0.1:${PORT} — press CTRL-C to stop"
python -m http.server "${PORT}" --bind 127.0.0.1
