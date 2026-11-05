#!/bin/bash
# Installs CodeFlux on macOS (Apple Silicon) from the latest GitHub release.
# curl does not set the quarantine flag, so Gatekeeper never treats the unsigned app as "downloaded from the internet".
#   curl -fsSL https://github.com/ContessaIntelligence/codeflux/releases/latest/download/install-mac.sh | bash
set -euo pipefail

[ "$(uname -s)" = "Darwin" ] || { echo "This installer is for macOS." >&2; exit 1; }
[ "$(uname -m)" = "arm64" ] || { echo "Only Apple Silicon (arm64) builds are published." >&2; exit 1; }

repo="ContessaIntelligence/codeflux"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Downloading CodeFlux..."
curl -fL --progress-bar -o "$tmp/CodeFlux.app.tar" "https://github.com/$repo/releases/latest/download/CodeFlux-mac-arm64.app.tar"

tar -xf "$tmp/CodeFlux.app.tar" -C "$tmp"
rm -rf /Applications/CodeFlux.app
mv "$tmp/CodeFlux.app" /Applications/CodeFlux.app
xattr -cr /Applications/CodeFlux.app

echo "Installed to /Applications/CodeFlux.app"
open /Applications/CodeFlux.app
