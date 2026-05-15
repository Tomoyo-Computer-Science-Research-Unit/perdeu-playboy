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

import pandas as pd
import httpx

from app.config import settings
from app.constants import ANALYSIS_START_YEAR
from app.etl.extract import checksum_file
from app.etl.sources import default_isp_sources
from app.etl.ssp_sp import sp_monthly_rows, sp_municipalities, sp_source_metadata
from app.services import isp_repository, population_repository
from app.services.analytics import latest_period, methodology
from app.services.governor_performance import governor_performance
from app.services.indicator_catalog import INDICATORS
from app.services.territory_repository import ISP_TERRITORIAL_DIVISION_URL
from app.services.territory_repository import territorial_units


TERRITORY_TYPES = ("state", "municipality", "police_area")
IBGE_RJ_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/33"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_SP_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/35"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_SP_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios"
IBGE_SP_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2035/v/9324/p/last"
RIO_NEIGHBORHOODS_GEOJSON_URL = (
    "https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Cartografia/"
    "Limites_administrativos/FeatureServer/4/query"
    "?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson"
)
RIO_NEIGHBORHOOD_POPULATION_URL = (
    "https://www.arcgis.com/sharing/rest/content/items/"
    "814c735b54c741dcbaf8e865f2bfb42d/data"
)


def export_static_frontend(output_path: Path) -> None:
    latest = latest_period()
    month_keys = _month_keys(ANALYSIS_START_YEAR, latest.year, latest.month)
    month_index = {key: index for index, key in enumerate(month_keys)}
    rj_state = _rj_state_payload(month_keys, month_index)
    sp_state = _sp_state_payload(month_keys, month_index, latest.year, latest.month)

    snapshot = {
        "generated_at": datetime.now(ZoneInfo("America/Sao_Paulo")).isoformat(timespec="seconds"),
        "analysis_start_year": ANALYSIS_START_YEAR,
        "latest_period": latest.model_dump(mode="json"),
        "month_keys": month_keys,
        **rj_state,
        "governor_performance": governor_performance().model_dump(mode="json"),
        "states": {
            "RJ": rj_state,
            "SP": sp_state,
        },
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def _rj_state_payload(month_keys: list[str], month_index: dict[str, int]) -> dict[str, object]:
    return {
        "uf": "RJ",
        "name": "Rio de Janeiro",
        "latest_period": latest_period().model_dump(mode="json"),
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
        "municipality_geometries": _municipality_geometries(),
        "rio_neighborhood_geometries": _rio_neighborhood_geometries(),
        "sources": _source_metadata(),
        "methodology": methodology(),
        "series": _series(month_keys, month_index),
        "coverage": {
            "state_start_year": 2000,
            "municipality_start_year": 2014,
            "police_area_start_year": 2003,
            "map_drilldown": "rio_city",
        },
    }


def _sp_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    frame = sp_monthly_rows(start_year=2015, end_year=latest_year, end_month=latest_month)
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    sp_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "SSP-SP Números Sem Mistério + Sinesp VDE/MJSP",
    }
    return {
        "uf": "SP",
        "name": "São Paulo",
        "latest_period": sp_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado de São Paulo"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sp_municipalities()
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _sp_population_by_municipality(),
        "municipality_geometries": _sp_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sp_source_metadata() + _sp_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "São Paulo usa a API oficial SSP-SP/Números Sem Mistério para ocorrências mensais "
                "por estado e município. Feminicídio e morte por intervenção de agente do Estado "
                "são complementados pelo Sinesp VDE/MJSP quando não estão no bloco mensal da SSP-SP."
            ),
            "limitations": [
                "SP começa em 2015 nesta integração porque o complemento Sinesp VDE cobre 2015-2026.",
                "Em SP, roubo de rua usa a rubrica oficial SSP-SP 'ROUBO - OUTROS' como proxy, não a composição ISP-RJ.",
                "Morte por intervenção e feminicídio podem ter calendário de atualização diferente da SSP-SP.",
                "Não há divisão por CISP/bairro para SP nesta versão; o nível subestadual é municipal.",
            ],
        },
        "series": _series_for_sp_frame(frame, month_keys, month_index),
        "coverage": {
            "state_start_year": 2015,
            "municipality_start_year": 2015,
            "police_area_start_year": None,
            "map_drilldown": None,
        },
    }


def _month_keys(start_year: int, end_year: int, end_month: int) -> list[str]:
    keys: list[str] = []
    for year in range(start_year, end_year + 1):
        max_month = end_month if year == end_year else 12
        for month in range(1, max_month + 1):
            keys.append(f"{year:04d}-{month:02d}")
    return keys


def _series(month_keys: list[str], month_index: dict[str, int]) -> dict[str, dict[str, dict[str, list[float]]]]:
    result: dict[str, dict[str, dict[str, list[float]]]] = {}

    for indicator in INDICATORS:
        result[indicator.code] = {}
        for territory_type in TERRITORY_TYPES:
            frame = isp_repository.rows(
                indicator.code,
                territory_type,
                start_year=ANALYSIS_START_YEAR,
            )
            result[indicator.code][territory_type] = _series_for_frame(frame, month_keys, month_index)

    return result


def _series_for_frame(
    frame: pd.DataFrame,
    month_keys: list[str],
    month_index: dict[str, int],
) -> dict[str, list[float]]:
    output: dict[str, list[float]] = {}
    if frame.empty:
        return output

    grouped = frame.groupby(["territory_name", "year", "month"], as_index=False)["value"].sum()
    for territory_name, group in grouped.groupby("territory_name", sort=True):
        values = [0.0] * len(month_keys)
        for row in group.to_dict(orient="records"):
            key = f"{int(row['year']):04d}-{int(row['month']):02d}"
            index = month_index.get(key)
            if index is not None:
                values[index] = round(float(row["value"]), 1)
        output[str(territory_name)] = values

    return output


def _series_for_sp_frame(
    frame: pd.DataFrame,
    month_keys: list[str],
    month_index: dict[str, int],
) -> dict[str, dict[str, dict[str, list[float]]]]:
    result: dict[str, dict[str, dict[str, list[float]]]] = {}
    for indicator in [item.code for item in INDICATORS]:
        result[indicator] = {}
        for territory_type in TERRITORY_TYPES:
            filtered = frame[(frame["indicator"] == indicator) & (frame["territory_type"] == territory_type)]
            result[indicator][territory_type] = _series_for_frame(filtered, month_keys, month_index)
    return result


def _population_by_municipality() -> dict[str, float]:
    populations: dict[str, float] = {}
    for name in isp_repository.territories("municipality"):
        value = population_repository.population_for_municipality(municipality_name=name)
        if value is not None:
            populations[name] = float(value)
    return populations


def _sp_population_by_municipality() -> dict[str, float]:
    path = _ensure_sp_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+SP$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _source_metadata() -> list[dict[str, object]]:
    raw_isp_dir = settings.data_dir / "raw" / "isp"
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    rows: list[dict[str, object]] = []

    for source in default_isp_sources():
        path = raw_isp_dir / source.file_name
        rows.append(_file_source_row(source.name, source.url, path, source.territory_type))

    territorial_path = raw_isp_dir / "Relacao_RISPxAISPxCISP.csv"
    rows.append(
        _file_source_row(
            "isp_territorial_division",
            ISP_TERRITORIAL_DIVISION_URL,
            territorial_path,
            "territorial_division",
        )
    )

    population_path = raw_ibge_dir / "population_municipalities_rj_latest.json"
    rows.append(
        _file_source_row(
            "ibge_population_municipalities_rj",
            "https://sidra.ibge.gov.br/tabela/6579",
            population_path,
            "population",
        )
    )
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


def _sp_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_sp",
            IBGE_SP_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_sp_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_sp",
            IBGE_SP_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "sp_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_sp",
            IBGE_SP_MUNICIPALITIES_URL,
            raw_ibge_dir / "sp_municipalities.json",
            "territory",
        ),
    ]


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


def _municipality_geometries() -> dict[str, object]:
    path = _ensure_municipality_geometries_file()
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
                "properties": {
                    "ibge_code": ibge_code,
                    "territory_name": name,
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


def _sp_municipality_geometries() -> dict[str, object]:
    path = _ensure_sp_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _sp_municipality_code_to_name()
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
                "properties": {
                    "ibge_code": ibge_code,
                    "territory_name": name,
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


def _rio_neighborhood_geometries() -> dict[str, object]:
    path = _ensure_rio_neighborhood_geometries_file()
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


def _ensure_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "rj_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_RJ_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_sp_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "sp_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_SP_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_sp_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "sp_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_SP_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_sp_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_sp_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_SP_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_rio_neighborhood_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "rio_neighborhoods.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(RIO_NEIGHBORHOODS_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_rio_neighborhood_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "rio_neighborhood_population_2022.zip"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(RIO_NEIGHBORHOOD_POPULATION_URL, timeout=90, follow_redirects=True)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _rio_neighborhood_population() -> dict[str, float]:
    path = _ensure_rio_neighborhood_population_file()
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


def _normalize_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    without_marks = "".join(character for character in normalized if not unicodedata.combining(character))
    return re.sub(r"\s+", " ", without_marks.casefold()).strip()


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


def _sp_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_sp_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def period_date(year: int, month: int) -> str:
    return date(year, month, monthrange(year, month)[1]).isoformat()


def main() -> None:
    parser = argparse.ArgumentParser(description="Exporta um snapshot estático para o frontend.")
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
