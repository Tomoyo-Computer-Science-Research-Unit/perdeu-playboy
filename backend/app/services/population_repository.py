from __future__ import annotations

import json
import logging
import re
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx
import pandas as pd

from app.config import settings

logger = logging.getLogger(__name__)

IBGE_POPULATION_SOURCE_NAME = "IBGE SIDRA - Populacao residente estimada"
IBGE_ESTIMATED_POPULATION_URL = (
    "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2033/v/9324/p/last"
)
IBGE_CENSUS_POPULATION_URL = (
    "https://apisidra.ibge.gov.br/values/t/4714/n6/in%20n3%2033/v/93/p/2022"
)


def population_for_municipality(ibge_code: object = None, municipality_name: str | None = None) -> float | None:
    populations = municipality_populations()
    code = _clean_code(ibge_code)
    if code and code in populations["by_code"]:
        return populations["by_code"][code]["population"]

    if municipality_name:
        normalized_name = _normalize_name(municipality_name)
        row = populations["by_name"].get(normalized_name)
        if row:
            return row["population"]

    return None


@lru_cache(maxsize=1)
def municipality_populations() -> dict[str, dict[str, dict[str, float | str | int]]]:
    rows = _load_or_download_population_rows()
    parsed = _parse_sidra_rows(rows)
    return {
        "by_code": {row["ibge_code"]: row for row in parsed},
        "by_name": {row["normalized_name"]: row for row in parsed},
    }


def _load_or_download_population_rows() -> list[dict[str, Any]]:
    cache_path = _cache_path()
    if cache_path.exists() and cache_path.stat().st_size > 0:
        try:
            return json.loads(cache_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            logger.warning("Ignoring invalid IBGE population cache at %s", cache_path)

    for url in (IBGE_ESTIMATED_POPULATION_URL, IBGE_CENSUS_POPULATION_URL):
        try:
            rows = _download_population_rows(url)
        except httpx.HTTPError as exc:
            logger.warning("IBGE population download failed from %s: %s", url, exc)
            continue
        if rows:
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            cache_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
            logger.info("Cached %s IBGE municipality population rows from %s", len(rows), url)
            return rows

    logger.warning("No IBGE population source available; rates per 100k will be omitted")
    return []


def _download_population_rows(url: str) -> list[dict[str, Any]]:
    with httpx.Client(timeout=60, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()
        data = response.json()
    if not isinstance(data, list):
        return []
    return [row for row in data if isinstance(row, dict)]


def _parse_sidra_rows(rows: list[dict[str, Any]]) -> list[dict[str, float | str | int]]:
    parsed: list[dict[str, float | str | int]] = []
    for row in rows:
        code = _clean_code(row.get("D1C"))
        name = _clean_municipality_name(row.get("D1N"))
        value = _numeric_population(row.get("V"))
        if not code or not name or value is None:
            continue
        parsed.append(
            {
                "ibge_code": code,
                "municipality_name": name,
                "normalized_name": _normalize_name(name),
                "population": value,
                "year": int(row["D3C"]) if str(row.get("D3C", "")).isdigit() else 0,
                "source_name": IBGE_POPULATION_SOURCE_NAME,
            }
        )
    return parsed


def _cache_path() -> Path:
    return (settings.data_dir / "raw" / "ibge" / "population_municipalities_rj_latest.json").resolve()


def _clean_code(value: object) -> str:
    if value is None or pd.isna(value):
        return ""
    text = str(value).strip()
    if not text:
        return ""
    if re.fullmatch(r"\d+\.0", text):
        text = text[:-2]
    return re.sub(r"\D", "", text)


def _clean_municipality_name(value: object) -> str:
    if value is None or pd.isna(value):
        return ""
    return re.sub(r"\s+-\s+RJ$", "", str(value).strip(), flags=re.IGNORECASE)


def _normalize_name(value: str) -> str:
    text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", " ", text).strip().casefold()
    return re.sub(r"\s+", " ", text)


def _numeric_population(value: object) -> float | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip().replace(".", "").replace(",", ".")
    if not text or text in {"-", "..."}:
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    return number if number > 0 else None
