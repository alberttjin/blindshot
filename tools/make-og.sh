#!/bin/sh
# Renders tools/og.html to og.png (the link preview image) with headless Chrome.
cd "$(dirname "$0")/.." || exit 1
profile="$(mktemp -d)"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars --no-first-run \
  --user-data-dir="$profile" \
  --force-device-scale-factor=1 --window-size=1200,630 \
  --screenshot="$PWD/og.png" "file://$PWD/tools/og.html"
rm -rf "$profile"
