#!/bin/bash
set -euo pipefail

TAG=$(git describe --tags --abbrev=0)
VERSION="${TAG#v}"

echo "==> Cleaning previous build artifacts"
rm -rf out/

echo "==> Building (webpack)"
pnpm build

echo "==> Building documentation"
./scripts/build-docs.sh
cp docs/user-guide.html dist/renderer/user-guide.html

echo "==> Packaging for Linux"
pnpm make-linux

echo "==> Packaging for Windows"
pnpm make-windows

echo "==> Packaging for macOS"
pnpm make-osx

echo "==> Pushing tag $TAG to GitHub"
git push --follow-tags

echo "==> Creating GitHub release $TAG"
PDF_ARGS=()
if [[ -f docs/user-guide.pdf ]]; then
  PDF_ARGS=(docs/user-guide.pdf)
fi
gh release create "$TAG" \
  "out/gymscore_${VERSION}_amd64.deb" \
  "out/gymscore ${VERSION}.exe" \
  "out/gymscore-${VERSION}-mac.zip" \
  "${PDF_ARGS[@]}" --generate-notes

echo "==> Done: https://github.com/craigmiskell/gymscore/releases/tag/$TAG"
