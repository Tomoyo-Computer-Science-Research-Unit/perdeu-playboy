#!/usr/bin/env bash
# Publica um build local do site em g0v.tomoyo.systems/perdeu-playboy, sem passar pelo cron do
# servidor (útil para testar mudanças ainda não commitadas). O fluxo normal é o
# deploy/g0v/build-site.sh rodando no droplet; a landing e o nginx vivem no repositório g0v.
# Um build só serve todas as UFs publicadas em frontend/lib/ufs.json (o Rio na raiz, as demais em /<uf>/).
#
#   scripts/deploy-g0v.sh
#   SKIP_BUILD=1 scripts/deploy-g0v.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DROPLET="${DROPLET:-mail.tomoyo.systems}"
REMOTE_DIR="${REMOTE_DIR:-/root/g0v}"
BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-/perdeu-playboy}"

IP="$(doctl compute droplet list --format Name,PublicIPv4 --no-header | awk -v n="$DROPLET" '$1 == n { print $2 }')"
if [ -z "$IP" ]; then
  echo "droplet '$DROPLET' não encontrado no doctl" >&2
  exit 1
fi
echo "→ $DROPLET ($IP)"

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  (cd "$ROOT/frontend" && rm -rf out .next && NEXT_PUBLIC_BASE_PATH="$BASE_PATH" npm run build)
fi
ssh "root@$IP" "mkdir -p '$REMOTE_DIR/site$BASE_PATH'"
# Os status.json (raiz e /<uf>/) são do servidor; o rsync não os toca.
rsync -az --delete --exclude=/status.json --exclude='/*/status.json' --chmod=D755,F644 "$ROOT/frontend/out/" "root@$IP:$REMOTE_DIR/site$BASE_PATH/"
echo "✓ https://g0v.tomoyo.systems$BASE_PATH/"
