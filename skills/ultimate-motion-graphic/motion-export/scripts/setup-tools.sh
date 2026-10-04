#!/usr/bin/env bash
# Installs the Node tooling the ultimate-motion-graphic scripts need (Playwright, ffmpeg-static) into a
# shared cache once, outside the project, and prints the environment to use it:
#
#   eval "$(bash <skill-dir>/scripts/setup-tools.sh)"
#
# Afterwards `node <script>.cjs` finds playwright via NODE_PATH and ffmpeg via $FFMPEG.
set -euo pipefail

TOOLS="${MOTION_TOOLS_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/ultimate-motion-graphic/tools}"
mkdir -p "$TOOLS"
if [ ! -d "$TOOLS/node_modules/playwright" ] || [ ! -d "$TOOLS/node_modules/ffmpeg-static" ]; then
  echo "Installing playwright and ffmpeg-static into $TOOLS …" >&2
  (cd "$TOOLS" && { [ -f package.json ] || npm init -y >/dev/null; } && npm install --silent --no-audit --no-fund playwright ffmpeg-static >&2)
fi

# A system ffmpeg wins; otherwise use the static build.
FFMPEG="$(command -v ffmpeg || true)"
if [ -z "$FFMPEG" ]; then FFMPEG="$(cd "$TOOLS" && node -p "require('ffmpeg-static')")"; fi
if [ ! -x "$FFMPEG" ]; then echo "ffmpeg not found; install it (brew install ffmpeg) or rerun this script" >&2; exit 1; fi

# The scripts launch an installed Google Chrome first and fall back to Playwright's Chromium.
if [ ! -d "/Applications/Google Chrome.app" ] && ! command -v google-chrome >/dev/null 2>&1; then
  (cd "$TOOLS" && npx --yes playwright install chromium >&2)
fi

echo "export NODE_PATH=\"$TOOLS/node_modules\""
echo "export FFMPEG=\"$FFMPEG\""
