#!/usr/bin/env sh
# Depois do next build: tira do export as telas que a UF não tem. Tiroteios só existe onde há fonte
# (Fogo Cruzado, no Rio, fonte "isp" em frontend/lib/ufs.json); nas demais a rota renderiza 404 e sai.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UF="$(printf '%s' "${NEXT_PUBLIC_UF:-RJ}" | tr '[:lower:]' '[:upper:]')"
SOURCE="$(node -e 'const u=require(process.argv[1]).find((e)=>e.code===process.argv[2]); process.stdout.write(u?u.source:"isp")' "$ROOT/frontend/lib/ufs.json" "$UF")"
if [ "$SOURCE" != "isp" ]; then
  rm -rf "$ROOT/frontend/out/tiroteios"
fi
