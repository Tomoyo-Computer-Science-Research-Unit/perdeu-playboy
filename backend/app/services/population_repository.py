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
from app.etl import ibge_http
from app.uf import current

logger = logging.getLogger(__name__)

IBGE_POPULATION_SOURCE_NAME = "IBGE SIDRA - Populacao residente estimada"
# As URLs levam o codigo IBGE da UF corrente (33 = RJ, 35 = SP) no lugar de {uf}.
IBGE_ESTIMATED_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%20{uf}/v/9324/p/last"
IBGE_CENSUS_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/4714/n6/in%20n3%20{uf}/v/93/p/2022"


def _url(template: str) -> str:
    return template.format(uf=current().ibge_code)


def _uf_tag() -> str:
    return current().code.lower()


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


def municipality_populations() -> dict[str, dict[str, dict[str, float | str | int]]]:
    return _municipality_populations(current().code)


@lru_cache(maxsize=4)
def _municipality_populations(uf: str) -> dict[str, dict[str, dict[str, float | str | int]]]:
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

    for url in (_url(IBGE_ESTIMATED_POPULATION_URL), _url(IBGE_CENSUS_POPULATION_URL)):
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
    response = ibge_http.get(url, timeout=60)
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
    return (settings.data_dir / "raw" / "ibge" / f"population_municipalities_{_uf_tag()}_latest.json").resolve()


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
    return re.sub(r"\s+-\s+[A-Z]{2}$", "", str(value).strip(), flags=re.IGNORECASE)


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


# --- Series historicas de populacao (estado e municipios) ---------------------------------
#
# O IBGE publica estimativas anuais (tabela 6579) para quase todos os anos desde 2001, mas nao
# para anos de Censo/Contagem (2000, 2007, 2010, 2022) nem para 2023. Os anos de Censo vem das
# tabelas 200 (1991/2000/2010), 793 (Contagem 2007) e 4714 (Censo 2022). Anos sem nenhuma
# publicacao (1992-1999, 2023) sao interpolados linearmente entre os pontos vizinhos e
# marcados como `interpolated` no snapshot.

IBGE_STATE_ESTIMATES_URL = "https://apisidra.ibge.gov.br/values/t/6579/n3/{uf}/v/9324/p/all"
IBGE_STATE_CENSUS_URL = "https://apisidra.ibge.gov.br/values/t/200/n3/{uf}/v/93/p/1991,2000,2010"
IBGE_STATE_COUNT_2007_URL = "https://apisidra.ibge.gov.br/values/t/793/n3/{uf}/v/93/p/2007"
IBGE_STATE_CENSUS_2022_URL = "https://apisidra.ibge.gov.br/values/t/4714/n3/{uf}/v/93/p/2022"
IBGE_MUNICIPALITY_ESTIMATES_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%20{uf}/v/9324/p/all"
IBGE_MUNICIPALITY_CENSUS_2022_URL = IBGE_CENSUS_POPULATION_URL
IBGE_MUNICIPALITY_CENSUS_2010_URL = "https://apisidra.ibge.gov.br/values/t/200/n6/in%20n3%20{uf}/v/93/p/2010"

PopulationHistory = dict[int, dict[str, float | bool]]


def state_population_history(start_year: int, end_year: int) -> PopulationHistory:
    """Return the state population per year, interpolating years without an IBGE figure."""

    return _state_population_history(current().code, start_year, end_year)


@lru_cache(maxsize=4)
def _state_population_history(uf: str, start_year: int, end_year: int) -> PopulationHistory:
    observed: dict[int, float] = {}
    for url in (
        IBGE_STATE_CENSUS_URL,
        IBGE_STATE_COUNT_2007_URL,
        IBGE_STATE_CENSUS_2022_URL,
        IBGE_STATE_ESTIMATES_URL,
    ):
        url = _url(url)
        for row in _load_or_download_rows(url, _history_cache_path("state", url)):
            year = _row_year(row)
            value = _numeric_population(row.get("V"))
            if year and value is not None and year not in observed:
                observed[year] = value
    return _interpolate_years(observed, start_year, end_year)


def municipality_population_history(start_year: int, end_year: int) -> dict[str, PopulationHistory]:
    """Return population per year for every municipality of the current UF, keyed by name."""

    return _municipality_population_history(current().code, start_year, end_year)


@lru_cache(maxsize=4)
def _municipality_population_history(uf: str, start_year: int, end_year: int) -> dict[str, PopulationHistory]:
    observed: dict[str, dict[int, float]] = {}
    for url in (
        IBGE_MUNICIPALITY_CENSUS_2010_URL,
        IBGE_MUNICIPALITY_CENSUS_2022_URL,
        IBGE_MUNICIPALITY_ESTIMATES_URL,
    ):
        url = _url(url)
        for row in _load_or_download_rows(url, _history_cache_path("municipalities", url)):
            name = _clean_municipality_name(row.get("D1N"))
            year = _row_year(row)
            value = _numeric_population(row.get("V"))
            if not name or not year or value is None:
                continue
            observed.setdefault(name, {}).setdefault(year, value)
    return {
        name: _interpolate_years(years, start_year, end_year)
        for name, years in sorted(observed.items())
    }


def _interpolate_years(observed: dict[int, float], start_year: int, end_year: int) -> PopulationHistory:
    if not observed:
        return {}
    known_years = sorted(observed)
    output: PopulationHistory = {}
    for year in range(start_year, end_year + 1):
        if year in observed:
            output[year] = {"value": float(observed[year]), "interpolated": False}
            continue
        previous = max((known for known in known_years if known < year), default=None)
        following = min((known for known in known_years if known > year), default=None)
        if previous is None and following is None:
            continue
        if previous is None:
            value = observed[following]  # type: ignore[index]
        elif following is None:
            value = observed[previous]
        else:
            span = following - previous
            weight = (year - previous) / span
            value = observed[previous] + (observed[following] - observed[previous]) * weight
        output[year] = {"value": round(float(value)), "interpolated": True}
    return output


def _row_year(row: dict[str, Any]) -> int | None:
    for key in ("D3C", "D2C"):
        text = str(row.get(key, "")).strip()
        if text.isdigit():
            return int(text)
    return None


def _history_cache_path(scope: str, url: str) -> Path:
    table = re.search(r"/t/(\d+)/", url)
    period = re.search(r"/p/([^/]+)$", url)
    suffix = f"t{table.group(1) if table else 'x'}_{(period.group(1) if period else 'all').replace(',', '_')}"
    return (settings.data_dir / "raw" / "ibge" / f"population_{scope}_{_uf_tag()}_{suffix}.json").resolve()


def _load_or_download_rows(url: str, cache_path: Path) -> list[dict[str, Any]]:
    if cache_path.exists() and cache_path.stat().st_size > 0:
        try:
            return json.loads(cache_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            logger.warning("Ignoring invalid IBGE cache at %s", cache_path)
    try:
        rows = _download_population_rows(url)
    except httpx.HTTPError as exc:
        logger.warning("IBGE download failed from %s: %s", url, exc)
        return []
    if rows:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    return rows
