#!/usr/bin/env bash
# Publica o site em g0v.tomoyo.systems/perdeu-playboy no servidor principal da Tomoyo.
#
# O droplet é resolvido pelo doctl (nome em DROPLET, padrão mail.tomoyo.systems); os arquivos
# sobem por rsync/ssh como root e o nginx estático é (re)criado com docker compose atrás do Traefik.
#
#   scripts/deploy-g0v.sh            # build + deploy
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
rsync -az --delete "$ROOT/frontend/out/" "root@$IP:$REMOTE_DIR/site$BASE_PATH/"
rsync -az "$ROOT/deploy/g0v/index.html" "root@$IP:$REMOTE_DIR/site/index.html"
rsync -az "$ROOT/deploy/g0v/nginx.conf" "$ROOT/deploy/g0v/docker-compose.yml" "root@$IP:$REMOTE_DIR/"
ssh "root@$IP" "cd '$REMOTE_DIR' && docker compose up -d --remove-orphans && docker exec g0v-static nginx -s reload"

echo "✓ https://g0v.tomoyo.systems$BASE_PATH/"
