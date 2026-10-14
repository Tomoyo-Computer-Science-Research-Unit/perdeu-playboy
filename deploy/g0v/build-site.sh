#!/usr/bin/env bash
# Roda no droplet, por cron, uma vez por dia: puxa main, baixa de novo os arquivos oficiais,
# confere o contrato de cada um, regenera o snapshot e, se o código ou os dados mudaram desde o
# último build, constrói o site, sincroniza a config do nginx e troca os arquivos servidos.
# Cada rodada entra em runs.jsonl e no status.json servido pelo site; falhas avisam por e-mail.
#
#   /root/g0v/build-site.sh               # só reconstrói se algo mudou
#   FORCE=1 /root/g0v/build-site.sh       # reconstrói de qualquer jeito
#   SKIP_DATA=1 /root/g0v/build-site.sh   # pula download, contrato e ETL; usa o snapshot de main
set -euo pipefail
export PATH=/usr/local/bin:/usr/bin:/bin

REPO="${REPO:-https://github.com/Tomoyo-Computer-Science-Research-Unit/perdeu-playboy.git}"
DIR="${DIR:-/root/g0v}"
SRC="$DIR/src"
MARK="$DIR/.site-built"
RUNS="$DIR/runs.jsonl"
CHECK="$DIR/check.json"
BASE_PATH="/perdeu-playboy"
STATUS_OUT="$DIR/site$BASE_PATH/status.json"
ALERT_TO="${ALERT_TO:-arete@tomoyo.systems}"
export ISP_DATA_BASE_URL="${ISP_DATA_BASE_URL:-http://www.ispdados.rj.gov.br/Arquivos}"
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS="--max-old-space-size=2048"

started="$(date +%s)"
key=""
note=""

log() { echo "$(date -Is) $*"; }

# record RESULTADO [detalhe]: uma linha JSON por rodada.
record() {
  python3 - "$1" "${2:-}" "$key" "$(( $(date +%s) - started ))" >> "$RUNS" <<'EOF'
import datetime, json, sys
print(json.dumps({
    "at": datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat(timespec="seconds"),
    "result": sys.argv[1],
    "detail": sys.argv[2] or None,
    "key": sys.argv[3] or None,
    "duration_s": int(sys.argv[4]),
}, ensure_ascii=False))
EOF
}

# notify ASSUNTO CORPO: e-mail pelo mailserver local.
notify() {
  printf 'From: g0v <g0v@tomoyo.systems>\nTo: %s\nSubject: %s\nContent-Type: text/plain; charset=utf-8\n\n%s\n' "$ALERT_TO" "$1" "$2" \
    | docker exec -i mailserver sendmail -t || log "aviso por e-mail falhou"
}

write_status() {
  if [ -x "${PY:-}" ] && [ -f "$SRC/frontend/lib/static-data.generated.json" ]; then
    (cd "$SRC/backend" && "$PY" -m app.etl.write_status --snapshot ../frontend/lib/static-data.generated.json \
      --runs "$RUNS" --check "$CHECK" --out "$STATUS_OUT") || log "status.json falhou"
  fi
}

on_error() {
  local line="$1"
  log "falhou na linha $line"
  record "falhou" "linha $line"
  notify "[perdeu-playboy] rodada falhou" "O build-site.sh parou na linha $line em $(hostname). Veja $DIR/build-site.log."
  write_status
}
trap 'on_error $LINENO' ERR

[ -d "$SRC/.git" ] || git clone -q "$REPO" "$SRC"
git -C "$SRC" fetch -q origin main
git -C "$SRC" reset -q --hard origin/main
rev="$(git -C "$SRC" rev-parse --short HEAD)"

# O script instalado é uma cópia deste arquivo; quando main o muda, troca e recomeça.
if [ -f "$SRC/deploy/g0v/build-site.sh" ] && ! cmp -s "$SRC/deploy/g0v/build-site.sh" "$0"; then
  cp "$SRC/deploy/g0v/build-site.sh" "$0"
  chmod 755 "$0"
  log "script atualizado a partir de $rev; recomeçando"
  exec "$0" "$@"
fi

PY="$SRC/backend/.venv/bin/python"
[ -x "$PY" ] || uv venv -q --python 3.12 "$SRC/backend/.venv"
uv pip install -q --python "$PY" -e "$SRC/backend"

if [ "${SKIP_DATA:-0}" != "1" ]; then
  # Sem cache dos arquivos brutos: baixar de novo é a checagem de arquivo novo.
  rm -rf "$SRC/data/raw/isp" "$SRC/data/raw/ibge"
  if check_output="$(cd "$SRC/backend" && "$PY" -m app.etl.check_sources --json "$CHECK" 2>&1)"; then
    log "contrato ok"
    if etl_output="$(cd "$SRC/backend" && "$PY" -m app.etl.export_static_frontend 2>&1)"; then
      log "ETL ok"
    else
      log "ETL falhou; usando o snapshot commitado em main"
      note="ETL falhou"
      notify "[perdeu-playboy] ETL falhou" "$(printf '%s\n\n%s' "O export falhou; o site segue com o snapshot de main." "$etl_output" | tail -c 6000)"
      git -C "$SRC" checkout -q -- frontend/lib
    fi
  else
    log "contrato falhou; usando o snapshot commitado em main"
    note="contrato falhou"
    notify "[perdeu-playboy] contrato dos arquivos do ISP falhou" "$(printf '%s\n\n%s' "Algum arquivo oficial mudou de forma. O site segue com o snapshot de main." "$check_output" | tail -c 6000)"
    git -C "$SRC" checkout -q -- frontend/lib
  fi
fi

# Chave do build: commit + conteúdo do snapshot sem o generated_at, que muda a cada execução.
key="$rev $(cd "$SRC" && "$PY" - <<'EOF'
import hashlib, json, pathlib
h = hashlib.sha256()
for name in ["frontend/lib/static-data.generated.json", *sorted(str(p) for p in pathlib.Path("frontend/lib/static-series").glob("*.generated.json")), "frontend/lib/static-geo.generated.json"]:
    data = json.loads(pathlib.Path(name).read_text(encoding="utf-8"))
    if isinstance(data, dict):
        data.pop("generated_at", None)
    h.update(json.dumps(data, sort_keys=True, separators=(",", ":")).encode())
latest = json.loads(pathlib.Path("frontend/lib/static-data.generated.json").read_text(encoding="utf-8"))["latest_period"]
print(f"{h.hexdigest()[:16]} ate={latest['year']}-{latest['month']:02d}")
EOF
)"

if [ "${FORCE:-0}" != "1" ] && [ -f "$MARK" ] && [ "$(cat "$MARK")" = "$key" ]; then
  log "sem mudança ($key)"
  record "sem mudança" "$note"
  write_status
  exit 0
fi

log "construindo ($key)"
(cd "$SRC/frontend" && npm ci --no-audit --no-fund --silent && rm -rf out .next && NEXT_PUBLIC_BASE_PATH="$BASE_PATH" npm run build --silent >/dev/null)

stage="$(mktemp -d)"
chmod 755 "$stage"
cp -r "$SRC/deploy/g0v/site/." "$stage/"
sed -i "s/VERSION/$rev/g" "$stage/index.html"
# A landing fica na raiz de site/; cada projeto (perdeu-playboy, emendas, ...) tem o seu
# subdiretório, publicado pelo seu próprio script. Os subdiretórios ficam fora do --delete.
rsync -a --delete --exclude='/*/' --chmod=D755,F644 "$stage/" "$DIR/site/"
rsync -a --delete --chmod=D755,F644 "$SRC/frontend/out/" "$DIR/site$BASE_PATH/"
rm -rf "$stage"

rsync -a --chmod=D755,F644 "$SRC/deploy/g0v/conf/" "$DIR/conf/"
docker exec g0v-static nginx -t >/dev/null 2>&1
docker exec g0v-static nginx -s reload 2>/dev/null
echo "$key" > "$MARK"
record "publicado" "$note"
write_status
log "publicado ($key)"
