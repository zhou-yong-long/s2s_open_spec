#!/usr/bin/env bash
# Copy canonical docs into delivery/ (hand-edited delivery/*.md are NOT overwritten).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEL="$ROOT/delivery"
mkdir -p "$DEL/ai-delivery"
cp "$ROOT/docs/ai-delivery/"*.md "$DEL/ai-delivery/"
cp "$ROOT/docs/karmastudio-sdd-delivery.md" "$DEL/karmastudio-sdd-delivery.md"
cp "$ROOT/scripts/bundle-INSTALL.md" "$DEL/INSTALL-OFFLINE-TGZ.md"
echo "Synced docs -> $DEL/ai-delivery/ and $DEL/karmastudio-sdd-delivery.md, $DEL/INSTALL-OFFLINE-TGZ.md"
