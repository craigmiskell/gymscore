#!/bin/bash
set -euo pipefail

TAG=$(git describe --tags --abbrev=0)

echo "==> Cleaning previous build artifacts"
rm -rf out/

echo "==> Building (webpack)"
npm run build

echo "==> Packaging for Linux"
npm run make-linux

echo "==> Packaging for Windows"
npm run make-windows

echo "==> Packaging for macOS"
npm run make-osx

echo "==> Pushing tag $TAG to GitHub"
git push --follow-tags

echo "==> Creating GitHub release $TAG"
gh release create "$TAG" out/*.deb out/*.exe out/*.zip --generate-notes

echo "==> Done: https://github.com/craigmiskell/gymscore/releases/tag/$TAG"
