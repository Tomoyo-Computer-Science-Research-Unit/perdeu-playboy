#!/usr/bin/env bash
# Roda no droplet, por cron, uma vez por dia: puxa main, baixa de novo os arquivos oficiais,
# regenera o snapshot e, se o código ou os dados mudaram desde o último build, constrói o site,
# sincroniza a config do nginx e troca os arquivos servidos.
#
#   /root/g0v/build-site.sh               # só reconstrói se algo mudou
#   FORCE=1 /root/g0v/build-site.sh       # reconstrói de qualquer jeito
#   SKIP_DATA=1 /root/g0v/build-site.sh   # pula o ETL e usa o snapshot commitado em main
set -euo pipefail
export PATH=/usr/local/bin:/usr/bin:/bin

REPO="${REPO:-https://github.com/Tomoyo-Computer-Science-Research-Unit/perdeu-playboy.git}"
DIR="${DIR:-/root/g0v}"
SRC="$DIR/src"
MARK="$DIR/.site-built"
BASE_PATH="/perdeu-playboy"
export ISP_DATA_BASE_URL="${ISP_DATA_BASE_URL:-http://www.ispdados.rj.gov.br/Arquivos}"
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS="--max-old-space-size=2048"

log() { echo "$(date -Is) $*"; }

[ -d "$SRC/.git" ] || git clone -q "$REPO" "$SRC"
git -C "$SRC" fetch -q origin main
git -C "$SRC" reset -q --hard origin/main
rev="$(git -C "$SRC" rev-parse --short HEAD)"

PY="$SRC/backend/.venv/bin/python"
[ -x "$PY" ] || uv venv -q --python 3.12 "$SRC/backend/.venv"
uv pip install -q --python "$PY" -e "$SRC/backend"

if [ "${SKIP_DATA:-0}" != "1" ]; then
  # Sem cache dos arquivos brutos: baixar de novo é a checagem de arquivo novo.
  rm -rf "$SRC/data/raw/isp" "$SRC/data/raw/ibge"
  if (cd "$SRC/backend" && "$PY" -m app.etl.export_static_frontend); then
    log "ETL ok"
  else
    log "ETL falhou; usando o snapshot commitado em main"
    git -C "$SRC" checkout -q -- frontend/lib
  fi
fi

# Chave do build: commit + conteúdo do snapshot sem o generated_at, que muda a cada execução.
key="$rev $(cd "$SRC" && "$PY" - <<'EOF'
import hashlib, json, pathlib
h = hashlib.sha256()
for name in ["frontend/lib/static-data.generated.json", "frontend/lib/static-geo.generated.json"]:
    data = json.loads(pathlib.Path(name).read_text(encoding="utf-8"))
    data.pop("generated_at", None)
    h.update(json.dumps(data, sort_keys=True, separators=(",", ":")).encode())
latest = json.loads(pathlib.Path("frontend/lib/static-data.generated.json").read_text(encoding="utf-8"))["latest_period"]
print(f"{h.hexdigest()[:16]} ate={latest['year']}-{latest['month']:02d}")
EOF
)"

if [ "${FORCE:-0}" != "1" ] && [ -f "$MARK" ] && [ "$(cat "$MARK")" = "$key" ]; then
  log "sem mudança ($key)"
  exit 0
fi

log "construindo ($key)"
(cd "$SRC/frontend" && npm ci --no-audit --no-fund --silent && rm -rf out .next && NEXT_PUBLIC_BASE_PATH="$BASE_PATH" npm run build --silent >/dev/null)

stage="$(mktemp -d)"
chmod 755 "$stage"
cp -r "$SRC/deploy/g0v/site/." "$stage/"
sed -i "s/VERSION/$rev/g" "$stage/index.html"
mkdir -p "$stage$BASE_PATH"
cp -r "$SRC/frontend/out/." "$stage$BASE_PATH/"
rsync -a --delete --chmod=D755,F644 "$stage/" "$DIR/site/"
rm -rf "$stage"

rsync -a --chmod=D755,F644 "$SRC/deploy/g0v/conf/" "$DIR/conf/"
docker exec g0v-static nginx -t >/dev/null 2>&1
docker exec g0v-static nginx -s reload 2>/dev/null
echo "$key" > "$MARK"
log "publicado ($key)"
