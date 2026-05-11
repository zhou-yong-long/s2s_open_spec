#!/usr/bin/env bash
# Build dist/, npm pack, zip tarball + INSTALL + optional full source archive.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v zip >/dev/null 2>&1; then
  echo "error: 'zip' is required (macOS: already installed; brew install zip)" >&2
  exit 1
fi

echo "==> npm install + build + test"
npm install
npm run build
npm test

RELEASE="$ROOT/release"
rm -rf "$RELEASE"
mkdir -p "$RELEASE"

VERSION="$(node -p "require('./package.json').version")"
STAMP="$(date +%Y%m%d-%H%M%S)"
BRANCH="$(git branch --show-current 2>/dev/null || echo unknown)"
BRANCH_SAFE="${BRANCH//\//-}"

TGZ="sdd-cli-${VERSION}.tgz"
echo "==> npm pack -> release/$TGZ"
npm pack --pack-destination "$RELEASE"

if [[ -d "$ROOT/.git" ]]; then
  SRC_ZIP="sdd-cli-${VERSION}-${BRANCH_SAFE}-full-source.zip"
  echo "==> git archive -> release/$SRC_ZIP"
  git archive --format=zip -o "$RELEASE/$SRC_ZIP" HEAD
else
  SRC_ZIP=""
fi

cp "$ROOT/scripts/bundle-INSTALL.md" "$RELEASE/INSTALL.md"

OUT_ZIP="sdd-cli-offline-${STAMP}.zip"
echo "==> zip -> release/$OUT_ZIP"
(
  cd "$RELEASE"
  if [[ -n "$SRC_ZIP" && -f "$SRC_ZIP" ]]; then
    zip -r "$OUT_ZIP" "$TGZ" INSTALL.md "$SRC_ZIP"
  else
    zip -r "$OUT_ZIP" "$TGZ" INSTALL.md
  fi
)

echo ""
echo "Done. Artifacts under $RELEASE/"
ls -la "$RELEASE"
