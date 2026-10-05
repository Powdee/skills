#!/bin/zsh
# Scaffold a motion-film project from the template (Remotion engine + example film).
# Usage: new_film.sh <project-dir>
set -euo pipefail
P=${1:?project dir}; mkdir -p "$P"; P=${P:A}
TPL=${0:A:h}/../template
if [[ -f "$P/package.json" ]]; then echo "already a project: $P"; else cp -R $TPL/. "$P/"; fi
command -v node >/dev/null || brew install node
command -v ffmpeg >/dev/null || brew install ffmpeg
[[ -d "$P/node_modules" ]] || (cd "$P" && npm install --no-audit --no-fund >/dev/null)
mkdir -p "$P"/{public/audio,public/sfx,public/fonts,public/brand,build,out}
# Python for the audio-sync / brand scripts (numpy only).
[[ -x "$P/.venv/bin/python" ]] || { python3 -m venv "$P/.venv" && "$P/.venv/bin/pip" install -q numpy; }
cd "$P" && npx tsc --noEmit && echo "ready: $P  (preview: npm run dev → http://localhost:3300)"
