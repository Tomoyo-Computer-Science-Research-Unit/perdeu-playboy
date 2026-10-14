#!/usr/bin/env sh
# Copia o snapshot de uma UF (frontend/data/<uf>/) para frontend/lib/, onde o código importa
# os arquivos gerados. Um build só contém os dados de uma UF.
#
#   scripts/use-uf.sh rj      # padrão: NEXT_PUBLIC_UF ou rj
#   scripts/use-uf.sh sp
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UF="$(printf '%s' "${1:-${NEXT_PUBLIC_UF:-rj}}" | tr '[:upper:]' '[:lower:]')"
SRC="$ROOT/frontend/data/$UF"
DST="$ROOT/frontend/lib"
if [ ! -s "$SRC/static-data.generated.json" ]; then
  echo "use-uf: $SRC/static-data.generated.json ausente" >&2
  exit 1
fi
rm -rf "$DST/static-series"
mkdir -p "$DST/static-series"
cp "$SRC/static-data.generated.json" "$SRC/static-geo.generated.json" "$DST/"
cp "$SRC"/static-series/*.generated.json "$DST/static-series/"
echo "$UF" > "$DST/.uf"
echo "use-uf: frontend/lib com os dados de $UF"
