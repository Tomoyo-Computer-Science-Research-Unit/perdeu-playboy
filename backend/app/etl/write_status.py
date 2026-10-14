"""Escreve o ``status.json`` servido pelo site: ultima checagem, ultimo build, arquivos oficiais
(local e no servidor do ISP) e o historico das ultimas execucoes.

Usado pelo ``deploy/g0v/build-site.sh`` no fim de cada rodada, com ou sem build::

    python -m app.etl.write_status --snapshot ../frontend/lib/static-data.generated.json \
        --runs /root/g0v/runs.jsonl --check /root/g0v/check.json --out /root/g0v/site/perdeu-playboy/status.json
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import httpx

RUNS_KEPT = 30
HEAD_TIMEOUT = 15.0


def build_status(snapshot: dict[str, Any], runs: list[dict[str, Any]], check: dict[str, Any] | None, probe: bool = True) -> dict[str, Any]:
    """Assemble the status payload from the snapshot, the run log and the contract report."""

    published = [run for run in runs if run.get("result") == "publicado"]
    sources = [dict(source) for source in snapshot.get("sources", [])]
    if probe:
        with httpx.Client(timeout=HEAD_TIMEOUT, follow_redirects=True) as client:
            for source in sources:
                if str(source.get("url", "")).lower().endswith(".csv"):
                    source["remote"] = _probe(client, str(source["url"]))
    return {
        "written_at": datetime.now(ZoneInfo("America/Sao_Paulo")).isoformat(timespec="seconds"),
        "snapshot": {"generated_at": snapshot.get("generated_at"), "latest_period": snapshot.get("latest_period")},
        "last_run": runs[-1] if runs else None,
        "last_published": published[-1] if published else None,
        "runs": list(reversed(runs[-RUNS_KEPT:])),
        "check": check,
        "sources": sources,
    }


def _probe(client: httpx.Client, url: str) -> dict[str, Any]:
    try:
        response = client.head(url)
    except httpx.HTTPError as exc:
        return {"status": None, "error": type(exc).__name__}
    size = response.headers.get("content-length")
    return {
        "status": response.status_code,
        "last_modified": response.headers.get("last-modified"),
        "size_bytes": int(size) if size and size.isdigit() else None,
    }


def read_runs(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    runs: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            try:
                runs.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return runs


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--runs", type=Path, required=True)
    parser.add_argument("--check", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--no-probe", action="store_true", help="nao consulta o servidor do ISP")
    args = parser.parse_args(argv)

    snapshot = json.loads(args.snapshot.read_text(encoding="utf-8"))
    check = json.loads(args.check.read_text(encoding="utf-8")) if args.check and args.check.exists() else None
    status = build_status(snapshot, read_runs(args.runs), check, probe=not args.no_probe)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(status, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
