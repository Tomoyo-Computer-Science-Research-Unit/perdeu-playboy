#!/usr/bin/env bash
# Roda no droplet, por cron, uma vez por dia: puxa main e, para cada UF publicada em
# frontend/lib/ufs.json, baixa de novo os arquivos oficiais, confere o contrato de cada um e regenera
# o snapshot (frontend/data/<uf>/). Se o código ou os dados mudaram desde o último build, constrói o
# site (um build só para todas as UFs) e troca os arquivos em /root/g0v/site/perdeu-playboy: o Rio na
# raiz, as demais em /<uf>/. Falha no ETL de uma UF não derruba as outras: aquela UF segue
# com o snapshot commitado. O Brasil (/br/, soma das 27 UFs no Sinesp) vem por último, porque lê os
# extratos que as rodadas das UFs acabaram de refazer; tem contrato, snapshot e data-ok como uma UF.
# A landing, o nginx e o cron são do repositório g0v. Cada rodada entra em runs.jsonl e no
# status.json de cada UF; falhas avisam por e-mail.
#
#   /root/g0v/build-site.sh               # só reconstrói se algo mudou
#   FORCE=1 /root/g0v/build-site.sh       # reconstrói de qualquer jeito
#   SKIP_DATA=1 /root/g0v/build-site.sh   # pula download, contrato e ETL; usa o último snapshot bom do servidor
set -euo pipefail
export PATH=/usr/local/bin:/usr/bin:/bin

REPO="${REPO:-https://github.com/Tomoyo-Computer-Science-Research-Unit/perdeu-playboy.git}"
DIR="${DIR:-/root/g0v}"
SRC="$DIR/src"
MARK="$DIR/.site-built"
RUNS="$DIR/runs.jsonl"
BASE_PATH="/perdeu-playboy"
ROOT_UF="RJ"
ALERT_TO="${ALERT_TO:-arete@tomoyo.systems}"
export ISP_DATA_BASE_URL="${ISP_DATA_BASE_URL:-http://www.ispdados.rj.gov.br/Arquivos}"
# Credenciais de fontes opcionais (Fogo Cruzado): FOGOCRUZADO_EMAIL, FOGOCRUZADO_PASSWORD, ENABLE_FOGOCRUZADO.
if [ -f "$DIR/.env-perdeu" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$DIR/.env-perdeu"
  set +a
fi
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

# base_path UF: /perdeu-playboy para o Rio, /perdeu-playboy/<uf> para as demais (onde mora o status.json).
base_path() {
  if [ "$1" = "$ROOT_UF" ]; then echo "$BASE_PATH"; else echo "$BASE_PATH/$(echo "$1" | tr '[:upper:]' '[:lower:]')"; fi
}

# Um status.json por UF, servido em <base>/status.json.
write_status() {
  [ -x "${PY:-}" ] || return 0
  for uf in ${UFS:-}; do
    lower="$(echo "$uf" | tr '[:upper:]' '[:lower:]')"
    snapshot="$SRC/frontend/data/$lower/static-data.generated.json"
    [ -f "$snapshot" ] || continue
    mkdir -p "$DIR/site$(base_path "$uf")"
    (cd "$SRC/backend" && "$PY" -m app.etl.write_status --snapshot "$snapshot" \
      --runs "$RUNS" --check "$DIR/check-$lower.json" --out "$DIR/site$(base_path "$uf")/status.json") || log "status.json de $uf falhou"
  done
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

# As 27 UFs na ordem de ufs.json e o Brasil (BR) por último: o total nacional depende dos extratos delas.
UFS="$(cd "$SRC/backend" && "$PY" -m app.uf)"
log "UFs publicadas: $(echo $UFS)"

if [ "${SKIP_DATA:-0}" = "1" ]; then
  # Sem ETL: o último snapshot bom de cada UF (se houver) no lugar do commitado em main.
  for uf in $UFS; do
    lower="$(echo "$uf" | tr '[:upper:]' '[:lower:]')"
    if [ -s "$DIR/data-ok/$lower/static-data.generated.json" ]; then
      rsync -a --delete "$DIR/data-ok/$lower/" "$SRC/frontend/data/$lower/"
      log "$uf: snapshot do último ETL bom"
    fi
  done
fi

if [ "${SKIP_DATA:-0}" != "1" ]; then
  # Sem cache dos arquivos do ISP e do IBGE: baixar de novo é a checagem de arquivo novo. As respostas da
  # SSP-SP e os arquivos do Sinesp ficam: anos fechados não mudam, e o ano corrente é baixado de novo.
  rm -rf "$SRC/data/raw/isp" "$SRC/data/raw/ibge"
  for uf in $UFS; do
    lower="$(echo "$uf" | tr '[:upper:]' '[:lower:]')"
    if check_output="$(cd "$SRC/backend" && "$PY" -m app.etl.check_sources --uf "$uf" --json "$DIR/check-$lower.json" 2>&1)"; then
      log "$uf: contrato ok"
      if etl_output="$(cd "$SRC/backend" && "$PY" -m app.etl.export_static_frontend --uf "$uf" 2>&1)"; then
        log "$uf: ETL ok"
        # Guarda o último snapshot bom fora do clone: um build com SKIP_DATA=1 usa este, não o de main,
        # que não tem as fontes que só o servidor alcança (Fogo Cruzado, com credenciais).
        mkdir -p "$DIR/data-ok/$lower"
        rsync -a --delete "$SRC/frontend/data/$lower/" "$DIR/data-ok/$lower/"
      else
        note="${note:+$note; }$uf: ETL falhou"
        git -C "$SRC" checkout -q -- "frontend/data/$lower"
        if [ -s "$DIR/data-ok/$lower/static-data.generated.json" ]; then
          log "$uf: ETL falhou; usando o snapshot do último ETL bom"
          rsync -a --delete "$DIR/data-ok/$lower/" "$SRC/frontend/data/$lower/"
        else
          log "$uf: ETL falhou; usando o snapshot commitado em main"
        fi
        notify "[perdeu-playboy] ETL de $uf falhou" "$(printf '%s\n\n%s' "O export de $uf falhou; essa UF segue com o último snapshot bom." "$etl_output" | tail -c 6000)"
      fi
    else
      log "$uf: contrato falhou; usando o snapshot commitado em main"
      note="${note:+$note; }$uf: contrato falhou"
      notify "[perdeu-playboy] contrato dos arquivos de $uf falhou" "$(printf '%s\n\n%s' "Algum arquivo oficial de $uf mudou de forma. Essa UF segue com o snapshot de main." "$check_output" | tail -c 6000)"
      git -C "$SRC" checkout -q -- "frontend/data/$lower"
    fi
  done
fi

# Chave do build: commit + conteúdo do snapshot sem o generated_at, que muda a cada execução.
key="$rev $(cd "$SRC" && "$PY" - $UFS <<'EOF'
import hashlib, json, pathlib, sys
h = hashlib.sha256()
latest = []
for uf in sys.argv[1:]:
    base = pathlib.Path("frontend/data") / uf.lower()
    for path in [base / "static-data.generated.json", *sorted((base / "static-series").glob("*.generated.json")), base / "static-geo.generated.json"]:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            data.pop("generated_at", None)
        h.update(json.dumps(data, sort_keys=True, separators=(",", ":")).encode())
    period = json.loads((base / "static-data.generated.json").read_text(encoding="utf-8"))["latest_period"]
    latest.append(f"{uf}={period['year']}-{period['month']:02d}")
print(f"{h.hexdigest()[:16]} {' '.join(latest)}")
EOF
)"

if [ "${FORCE:-0}" != "1" ] && [ -f "$MARK" ] && [ "$(cat "$MARK")" = "$key" ]; then
  log "sem mudança ($key)"
  record "sem mudança" "$note"
  write_status
  exit 0
fi

log "construindo ($key)"
(cd "$SRC/frontend" && npm ci --no-audit --no-fund --silent)
# Um build só para todas as UFs: o Rio na raiz, as demais em /<uf>/, os snapshots em /data/<uf>/
# (frontend/scripts/stage-data.mjs copia frontend/data/ para public/data/ antes do next build).
(cd "$SRC/frontend" && rm -rf out .next && NEXT_PUBLIC_BASE_PATH="$BASE_PATH" npm run build --silent >/dev/null)
mkdir -p "$DIR/site$BASE_PATH"
# Os status.json (raiz e /<uf>/) são escritos aqui por write_status; o rsync não os toca.
rsync -a --delete --exclude=/status.json --exclude='/*/status.json' --chmod=D755,F644 "$SRC/frontend/out/" "$DIR/site$BASE_PATH/"
echo "$key" > "$MARK"
record "publicado" "$note"
write_status
log "publicado ($key)"
