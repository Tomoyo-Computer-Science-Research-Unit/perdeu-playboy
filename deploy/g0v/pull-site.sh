#!/usr/bin/env bash
# Roda no droplet, por cron: puxa o branch `site` do repositório público (gerado pelo workflow
# "Dados e site") e, quando o commit mudou, troca os arquivos servidos pelo nginx.
#
#   /root/g0v/pull-site.sh            # só troca se o branch avançou
#   FORCE=1 /root/g0v/pull-site.sh    # troca de qualquer jeito
set -euo pipefail

REPO="${REPO:-https://github.com/Tomoyo-Computer-Science-Research-Unit/perdeu-playboy.git}"
DIR="${DIR:-/root/g0v}"
SRC="$DIR/site-src"
MARK="$DIR/.site-deployed"

if [ ! -d "$SRC/.git" ]; then
  git clone -q --depth 1 -b site "$REPO" "$SRC"
fi
git -C "$SRC" fetch -q --depth 1 origin site
git -C "$SRC" reset -q --hard origin/site
rev="$(git -C "$SRC" rev-parse HEAD)"

if [ "${FORCE:-0}" != "1" ] && [ -f "$MARK" ] && [ "$(cat "$MARK")" = "$rev" ]; then
  exit 0
fi

rsync -a --delete --exclude .git --chmod=D755,F644 "$SRC/" "$DIR/site/"
docker exec g0v-static nginx -s reload
echo "$rev" > "$MARK"
echo "$(date -Is) site $rev: $(git -C "$SRC" log -1 --format=%s)"
