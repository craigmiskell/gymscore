#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DOCS_DIR="$ROOT_DIR/docs"
SRC="$DOCS_DIR/user-guide.md"
CSS="$DOCS_DIR/style.css"
OUT_HTML="$DOCS_DIR/user-guide.html"
OUT_PDF="$DOCS_DIR/user-guide.pdf"

HTML_ONLY=false
if [[ "${1:-}" == "--html-only" ]]; then
  HTML_ONLY=true
fi

VERSION=$(node -p "require('$ROOT_DIR/package.json').version")
DATE=$(date +%Y-%m-%d)

if ! command -v pandoc &>/dev/null; then
  echo "ERROR: pandoc is required. Install it with: sudo apt install pandoc" >&2
  exit 1
fi

PANDOC_COMMON=(
  "$SRC"
  --from=markdown
  --standalone
  --metadata "title=GymScore User Guide"
  --metadata "subtitle=Version $VERSION"
  --metadata "date=$DATE"
)

echo "==> Building docs HTML (v$VERSION)"
pandoc "${PANDOC_COMMON[@]}" \
  --to=html5 \
  --self-contained \
  --resource-path="$DOCS_DIR" \
  --css="$CSS" \
  --output="$OUT_HTML"
echo "    $OUT_HTML"

if [[ "$HTML_ONLY" == "true" ]]; then
  exit 0
fi

# Detect an available PDF engine
PDF_ENGINE=""
for engine in weasyprint wkhtmltopdf xelatex pdflatex; do
  if command -v "$engine" &>/dev/null; then
    PDF_ENGINE="$engine"
    break
  fi
done

if [[ -z "$PDF_ENGINE" ]]; then
  echo "    WARN: No PDF engine found (weasyprint/wkhtmltopdf/xelatex/pdflatex)."
  echo "          Skipping PDF. Install one to enable: sudo apt install weasyprint"
else
  echo "==> Building docs PDF (engine: $PDF_ENGINE)"
  (cd "$DOCS_DIR" && pandoc "${PANDOC_COMMON[@]}" \
    --pdf-engine="$PDF_ENGINE" \
    --css="$CSS" \
    --output="$OUT_PDF")
  echo "    $OUT_PDF"
fi
