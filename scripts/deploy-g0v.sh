#!/usr/bin/env bash
# Publica o site em g0v.tomoyo.systems/perdeu-playboy no servidor principal da Tomoyo.
#
# O droplet é resolvido pelo doctl (nome em DROPLET, padrão mail.tomoyo.systems); os arquivos
# sobem por rsync/ssh como root e o nginx estático (docker compose, atrás do Traefik) é recarregado.
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
# A Cloudflare guarda css/js por 7 dias: o HTML referencia os assets com o hash do commit.
STAGE="$(mktemp -d)"
chmod 755 "$STAGE"  # mktemp cria 0700 e o rsync copiaria o modo: o nginx não leria a pasta
cp -r "$ROOT/deploy/g0v/site/." "$STAGE/"
sed -i "s/VERSION/$(git -C "$ROOT" rev-parse --short HEAD)/g" "$STAGE/index.html"
rsync -az "$STAGE/" "root@$IP:$REMOTE_DIR/site/"
rm -rf "$STAGE"
rsync -az "$ROOT/deploy/g0v/conf/" "root@$IP:$REMOTE_DIR/conf/"
rsync -az "$ROOT/deploy/g0v/docker-compose.yml" "root@$IP:$REMOTE_DIR/"
# Sem recriar o container: um container novo some do Traefik por alguns segundos e a Cloudflare
# guarda os 404 dos assets. Só recria quando o compose muda; senão recarrega o nginx.
ssh "root@$IP" "cd '$REMOTE_DIR' && docker compose up -d --remove-orphans && docker exec g0v-static nginx -s reload"

echo "✓ https://g0v.tomoyo.systems$BASE_PATH/"
