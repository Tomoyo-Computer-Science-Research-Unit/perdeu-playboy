"""Exporta o snapshot estatico (somente Rio de Janeiro) consumido pelo frontend.

Dois arquivos sao gerados em ``frontend/lib``:

* ``static-data.generated.json``: metadados, series mensais, populacao e mandatos.
* ``static-geo.generated.json``: geometrias (municipios e bairros do Rio), carregadas
  pelo frontend apenas na pagina de mapa.

As series mensais sao esparsas: cada territorio tem ``{"from": "AAAA-MM", "values": [...]}``,
onde ``values`` comeca no primeiro mes com dado e pode conter ``null`` para meses em que o
indicador nao foi apurado. Isso evita confundir "sem dado" com "zero ocorrencias".
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
import zipfile
from calendar import monthrange
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
import pandas as pd

from app.config import settings
from app.constants import ANALYSIS_START_YEAR
from app.etl.extract import checksum_file
from app.etl.sources import default_isp_sources
from app.services import isp_repository, population_repository
from app.services.analytics import latest_period, methodology
from app.services.governor_performance import GOVERNOR_TERMS, governor_performance
from app.services.indicator_catalog import INDICATORS
from app.services.territory_repository import ISP_TERRITORIAL_DIVISION_URL, territorial_units

TERRITORY_TYPES = ("state", "municipality", "police_area")
UF = "RJ"
UF_NAME = "Rio de Janeiro"
STATE_TERRITORY_NAME = "Estado do Rio de Janeiro"
GEO_PRECISION = 5  # ~1 m; o bastante para mapas coropleticos

IBGE_RJ_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/33"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
RIO_NEIGHBORHOODS_GEOJSON_URL = (
    "https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Cartografia/"
    "Limites_administrativos/FeatureServer/4/query"
    "?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson"
)
RIO_NEIGHBORHOOD_POPULATION_URL = (
    "https://www.arcgis.com/sharing/rest/content/items/"
    "814c735b54c741dcbaf8e865f2bfb42d/data"
)

Series = dict[str, object]
SeriesStore = dict[str, dict[str, dict[str, Series]]]


def export_static_frontend(output_path: Path, geo_output_path: Path | None = None) -> None:
    latest = latest_period()
    month_keys = _month_keys(ANALYSIS_START_YEAR, latest.year, latest.month)
    month_index = {key: index for index, key in enumerate(month_keys)}
    series, coverage = _series(month_keys, month_index)
    generated_at = datetime.now(ZoneInfo("America/Sao_Paulo")).isoformat(timespec="seconds")

    snapshot = {
        "generated_at": generated_at,
        "analysis_start_year": ANALYSIS_START_YEAR,
        "uf": UF,
        "name": UF_NAME,
        "latest_period": latest.model_dump(mode="json"),
        "month_keys": month_keys,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            territory_type: [
                {"territory_type": territory_type, "name": name}
                for name in isp_repository.territories(territory_type)
            ]
            for territory_type in TERRITORY_TYPES
        },
        "territorial_units": territorial_units("Rio de Janeiro"),
        "population_by_municipality": _population_by_municipality(),
        "population_history": {
            "state": _population_history_payload(
                population_repository.state_population_history(ANALYSIS_START_YEAR, latest.year)
            ),
            "municipality": {
                name: _population_history_payload(history)
                for name, history in population_repository.municipality_population_history(
                    ANALYSIS_START_YEAR, latest.year
                ).items()
            },
        },
        "governor_terms": [
            {
                "governor": term.governor,
                "party_or_condition": term.party_or_condition,
                "term_start": term.start.isoformat(),
                "term_end": term.end.isoformat() if term.end else None,
            }
            for term in GOVERNOR_TERMS
        ],
        "governor_performance": governor_performance().model_dump(mode="json"),
        "sources": _source_metadata(),
        "methodology": methodology(),
        "series": series,
        "coverage": coverage,
    }
    geo = {
        "generated_at": generated_at,
        "municipality_geometries": _round_collection(_municipality_geometries()),
        "rio_neighborhood_geometries": _round_collection(_rio_neighborhood_geometries()),
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(_dumps(snapshot), encoding="utf-8")
    geo_path = geo_output_path or output_path.with_name("static-geo.generated.json")
    geo_path.write_text(_dumps(geo), encoding="utf-8")


def _dumps(payload: object) -> str:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


# --- Series --------------------------------------------------------------------------------


def _month_keys(start_year: int, end_year: int, end_month: int) -> list[str]:
    keys: list[str] = []
    for year in range(start_year, end_year + 1):
        max_month = end_month if year == end_year else 12
        for month in range(1, max_month + 1):
            keys.append(f"{year:04d}-{month:02d}")
    return keys


def _series(month_keys: list[str], month_index: dict[str, int]) -> tuple[SeriesStore, dict[str, object]]:
    """Build sparse monthly series plus a coverage summary per territory type and indicator."""

    result: SeriesStore = {}
    first_month: dict[str, dict[str, str | None]] = {}
    latest_by_type: dict[str, str | None] = {}

    for indicator in INDICATORS:
        result[indicator.code] = {}
        first_month[indicator.code] = {}
        for territory_type in TERRITORY_TYPES:
            frame = isp_repository.rows(indicator.code, territory_type, start_year=ANALYSIS_START_YEAR)
            result[indicator.code][territory_type] = _series_for_frame(frame, month_keys, month_index)
            first_month[indicator.code][territory_type] = _first_key(frame)
            last_key = _last_key(frame)
            if last_key and (latest_by_type.get(territory_type) or "") < last_key:
                latest_by_type[territory_type] = last_key

    reference = first_month.get("letalidade_violenta", {})
    coverage: dict[str, object] = {
        "state_start_year": ANALYSIS_START_YEAR,
        "municipality_start_year": _year_of(reference.get("municipality")),
        "police_area_start_year": _year_of(reference.get("police_area")),
        "latest_by_type": latest_by_type,
        "first_month_by_indicator": first_month,
        "map_drilldown": "rio_city",
    }
    return result, coverage


def _series_for_frame(frame: pd.DataFrame, month_keys: list[str], month_index: dict[str, int]) -> dict[str, Series]:
    output: dict[str, Series] = {}
    if frame.empty:
        return output

    grouped = frame.groupby(["territory_name", "year", "month"], as_index=False)["value"].sum()
    for territory_name, group in grouped.groupby("territory_name", sort=True):
        indexes: list[int] = []
        values_by_index: dict[int, float] = {}
        for row in group.to_dict(orient="records"):
            key = f"{int(row['year']):04d}-{int(row['month']):02d}"
            index = month_index.get(key)
            if index is None:
                continue
            indexes.append(index)
            values_by_index[index] = round(float(row["value"]), 1)
        if not indexes:
            continue
        start, end = min(indexes), max(indexes)
        values: list[float | None] = [values_by_index.get(index) for index in range(start, end + 1)]
        output[str(territory_name)] = {"from": month_keys[start], "values": values}

    return output


def _first_key(frame: pd.DataFrame) -> str | None:
    if frame.empty:
        return None
    row = frame.sort_values(["year", "month"]).iloc[0]
    return f"{int(row['year']):04d}-{int(row['month']):02d}"


def _last_key(frame: pd.DataFrame) -> str | None:
    if frame.empty:
        return None
    row = frame.sort_values(["year", "month"]).iloc[-1]
    return f"{int(row['year']):04d}-{int(row['month']):02d}"


def _year_of(key: str | None) -> int | None:
    return int(key[:4]) if key else None


# --- Populacao -----------------------------------------------------------------------------


def _population_by_municipality() -> dict[str, float]:
    populations: dict[str, float] = {}
    for name in isp_repository.territories("municipality"):
        value = population_repository.population_for_municipality(municipality_name=name)
        if value is not None:
            populations[name] = float(value)
    return populations


def _population_history_payload(history: population_repository.PopulationHistory) -> dict[str, dict[str, object]]:
    return {str(year): {"value": row["value"], "interpolated": row["interpolated"]} for year, row in sorted(history.items())}


# --- Fontes ---------------------------------------------------------------------------------


def _source_metadata() -> list[dict[str, object]]:
    raw_isp_dir = settings.data_dir / "raw" / "isp"
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    rows: list[dict[str, object]] = []

    for source in default_isp_sources():
        rows.append(_file_source_row(source.name, source.url, raw_isp_dir / source.file_name, source.territory_type))

    rows.append(
        _file_source_row(
            "isp_territorial_division",
            ISP_TERRITORIAL_DIVISION_URL,
            raw_isp_dir / "Relacao_RISPxAISPxCISP.csv",
            "territorial_division",
        )
    )
    rows.append(
        _file_source_row(
            "ibge_population_municipalities_rj",
            "https://sidra.ibge.gov.br/tabela/6579",
            raw_ibge_dir / "population_municipalities_rj_latest.json",
            "population",
        )
    )
    for path in sorted(raw_ibge_dir.glob("population_*_rj_t*.json")):
        rows.append(_file_source_row(path.stem, "https://sidra.ibge.gov.br/", path, "population"))
    rows.append(
        _file_source_row(
            "ibge_municipality_geometries_rj",
            IBGE_RJ_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "rj_municipalities_min.geojson",
            "geometry",
        )
    )
    rows.append(
        _file_source_row(
            "data_rio_neighborhood_geometries_rio",
            RIO_NEIGHBORHOODS_GEOJSON_URL,
            raw_ibge_dir / "rio_neighborhoods.geojson",
            "geometry",
        )
    )
    rows.append(
        _file_source_row(
            "data_rio_neighborhood_population_2022",
            RIO_NEIGHBORHOOD_POPULATION_URL,
            raw_ibge_dir / "rio_neighborhood_population_2022.zip",
            "population",
        )
    )
    return rows


def _file_source_row(name: str, url: str, path: Path, category: str) -> dict[str, object]:
    exists = path.exists()
    return {
        "name": name,
        "category": category,
        "url": url,
        "file_name": path.name,
        "checksum_sha256": checksum_file(path) if exists else None,
        "size_bytes": path.stat().st_size if exists else None,
        "available": exists,
    }


# --- Geometrias ----------------------------------------------------------------------------


def _municipality_geometries() -> dict[str, object]:
    path = _ensure_file("rj_municipalities_min.geojson", IBGE_RJ_MUNICIPALITIES_GEOJSON_URL)
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _municipality_code_to_name()
    features = []
    for feature in data.get("features", []):
        properties = feature.get("properties") or {}
        ibge_code = str(properties.get("codarea") or "")
        name = code_to_name.get(ibge_code)
        if not name:
            continue
        features.append(
            {
                "type": "Feature",
                "geometry": feature.get("geometry"),
                "properties": {"ibge_code": ibge_code, "territory_name": name},
            }
        )
    return {"type": "FeatureCollection", "features": features}


def _rio_neighborhood_geometries() -> dict[str, object]:
    path = _ensure_file("rio_neighborhoods.geojson", RIO_NEIGHBORHOODS_GEOJSON_URL)
    data = json.loads(path.read_text(encoding="utf-8"))
    neighborhood_to_unit = _rio_neighborhood_to_territorial_unit()
    neighborhood_population = _rio_neighborhood_population()
    aliases = {
        "imperial de sao cristovao": "sao cristovao",
        "osvaldo cruz": "oswaldo cruz",
    }
    features = []
    for feature in data.get("features", []):
        properties = feature.get("properties") or {}
        neighborhood_name = str(properties.get("nome") or "").strip()
        lookup_key = aliases.get(_normalize_name(neighborhood_name), _normalize_name(neighborhood_name))
        unit = neighborhood_to_unit.get(lookup_key)
        population = neighborhood_population.get(lookup_key)
        features.append(
            {
                "type": "Feature",
                "geometry": feature.get("geometry"),
                "properties": {
                    "territory_name": neighborhood_name,
                    "municipality": "Rio de Janeiro",
                    "source_territory_name": unit["territorial_unit"] if unit else None,
                    "cisp": unit["cisp"] if unit else None,
                    "police_area_name": unit["police_area_name"] if unit else None,
                    "source_level": "CISP" if unit else None,
                    "population": population,
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


def _round_collection(collection: dict[str, object]) -> dict[str, object]:
    features = []
    raw_features = collection.get("features") or []
    assert isinstance(raw_features, list)
    for feature in raw_features:
        geometry = dict(feature.get("geometry") or {})
        if "coordinates" in geometry:
            geometry["coordinates"] = _round_coordinates(geometry["coordinates"])
        features.append({**feature, "geometry": geometry})
    return {"type": "FeatureCollection", "features": features}


def _round_coordinates(value: object) -> object:
    if isinstance(value, (int, float)):
        return round(float(value), GEO_PRECISION)
    if isinstance(value, list):
        return [_round_coordinates(item) for item in value]
    return value


def _rio_neighborhood_population() -> dict[str, float]:
    path = _ensure_file("rio_neighborhood_population_2022.zip", RIO_NEIGHBORHOOD_POPULATION_URL)
    with zipfile.ZipFile(path) as archive:
        csv_name = next(name for name in archive.namelist() if name.lower().endswith(".csv"))
        with archive.open(csv_name) as file:
            frame = pd.read_csv(file, sep=";", encoding="latin1")

    value_columns = list(frame.columns[10:])
    frame["population"] = frame[value_columns].apply(pd.to_numeric, errors="coerce").fillna(0).sum(axis=1)
    return {
        _normalize_name(str(row["bairro"])): float(row["population"])
        for row in frame[["bairro", "population"]].to_dict(orient="records")
    }


def _rio_neighborhood_to_territorial_unit() -> dict[str, dict[str, object]]:
    output: dict[str, dict[str, object]] = {}
    for unit in territorial_units("Rio de Janeiro"):
        for neighborhood in _split_territorial_unit(str(unit["territorial_unit"])):
            output.setdefault(_normalize_name(neighborhood), unit)
    return output


def _split_territorial_unit(value: str) -> list[str]:
    cleaned = re.sub(r"\s*\(parte\)", "", value, flags=re.IGNORECASE)
    cleaned = cleaned.replace(" e ", ", ")
    return [part.strip() for part in cleaned.split(",") if part.strip()]


def _municipality_code_to_name() -> dict[str, str]:
    frame = isp_repository.rows("letalidade_violenta", "municipality", start_year=ANALYSIS_START_YEAR)
    if frame.empty or "ibge_code" not in frame.columns:
        return {}
    pairs = frame[["ibge_code", "territory_name"]].drop_duplicates()
    return {
        str(row["ibge_code"]): str(row["territory_name"])
        for row in pairs.to_dict(orient="records")
        if str(row.get("ibge_code") or "").strip()
    }


def _ensure_file(file_name: str, url: str) -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / file_name
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(url, timeout=90, follow_redirects=True)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _normalize_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    without_marks = "".join(character for character in normalized if not unicodedata.combining(character))
    return re.sub(r"\s+", " ", without_marks.casefold()).strip()


def period_date(year: int, month: int) -> str:
    return date(year, month, monthrange(year, month)[1]).isoformat()


def main() -> None:
    parser = argparse.ArgumentParser(description="Exporta o snapshot estatico do RJ para o frontend.")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[3] / "frontend" / "lib" / "static-data.generated.json",
    )
    args = parser.parse_args()
    export_static_frontend(args.output)
    print(args.output)


if __name__ == "__main__":
    main()
