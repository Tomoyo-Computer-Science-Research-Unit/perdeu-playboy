#!/usr/bin/env bash
# Publica um build local do site em g0v.tomoyo.systems/perdeu-playboy, sem passar pelo cron do
# servidor (útil para testar mudanças ainda não commitadas). O fluxo normal é o
# deploy/g0v/build-site.sh rodando no droplet; a landing e o nginx vivem no repositório g0v.
#
#   scripts/deploy-g0v.sh             # todas as UFs publicadas em frontend/lib/ufs.json
#   scripts/deploy-g0v.sh RJ SP       # só estas
#   SKIP_BUILD=1 scripts/deploy-g0v.sh RJ
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DROPLET="${DROPLET:-mail.tomoyo.systems}"
REMOTE_DIR="${REMOTE_DIR:-/root/g0v}"
BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-/perdeu-playboy}"
ROOT_UF="RJ"
ALL_UFS="$(python3 -c 'import json,sys; print(" ".join(u["code"] for u in json.load(open(sys.argv[1])) if u["published"]))' "$ROOT/frontend/lib/ufs.json")"
UFS="${*:-$ALL_UFS}"

IP="$(doctl compute droplet list --format Name,PublicIPv4 --no-header | awk -v n="$DROPLET" '$1 == n { print $2 }')"
if [ -z "$IP" ]; then
  echo "droplet '$DROPLET' não encontrado no doctl" >&2
  exit 1
fi
echo "→ $DROPLET ($IP)"

excludes=()
for uf in $ALL_UFS; do
  [ "$uf" = "$ROOT_UF" ] || excludes+=("--exclude=/$(echo "$uf" | tr '[:upper:]' '[:lower:]')/")
done

for uf in $UFS; do
  if [ "$uf" = "$ROOT_UF" ]; then base="$BASE_PATH"; else base="$BASE_PATH/$(echo "$uf" | tr '[:upper:]' '[:lower:]')"; fi
  if [ "${SKIP_BUILD:-0}" != "1" ]; then
    (cd "$ROOT/frontend" && rm -rf out .next && NEXT_PUBLIC_UF="$uf" NEXT_PUBLIC_BASE_PATH="$base" npm run build)
  fi
  ssh "root@$IP" "mkdir -p '$REMOTE_DIR/site$base'"
  if [ "$uf" = "$ROOT_UF" ]; then
    rsync -az --delete "${excludes[@]}" --exclude=/status.json --chmod=D755,F644 "$ROOT/frontend/out/" "root@$IP:$REMOTE_DIR/site$base/"
  else
    rsync -az --delete --exclude=/status.json --chmod=D755,F644 "$ROOT/frontend/out/" "root@$IP:$REMOTE_DIR/site$base/"
  fi
  echo "✓ https://g0v.tomoyo.systems$base/"
done
(cd "$ROOT/frontend" && sh ../scripts/use-uf.sh "$ROOT_UF" >/dev/null)
