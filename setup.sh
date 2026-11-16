#!/usr/bin/env bash
# Instalacja zestawu. Wymaga: Node 18+, Python 3, ffmpeg, Google Chrome lub Chromium.
set -e
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Brak Node.js (nodejs.org)"; exit 1; }
command -v ffmpeg >/dev/null || { echo "Brak ffmpeg (ffmpeg.org)"; exit 1; }
npm install --no-audit --no-fund --silent
python3 -m pip install -q faster-whisper numpy 2>/dev/null || python3 -m pip install -q --break-system-packages faster-whisper numpy
node -e "import('./tools/browser.mjs').then(m => { const c = m.findChrome(); console.log(c ? 'Chrome: ' + c : 'UWAGA: nie znaleziono Chrome, ustaw CHROME=/ścieżka'); })"
echo "Gotowe. Start: python3 tools/transcribe.py lektor.mp3 work/words.json"
