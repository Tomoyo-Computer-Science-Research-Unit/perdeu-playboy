"""Exporta o snapshot estatico de uma UF (ou do Brasil, ``--uf BR``) consumido pelo frontend.

No Brasil o pais ocupa o lugar do estado e as 27 UFs o dos municipios (``brasil_repository``):
populacao do pais e das UFs, malha das UFs, mandatos presidenciais.

Arquivos gerados em ``frontend/data/<uf>`` (o build copia a pasta da UF para ``frontend/lib``):

* ``static-data.generated.json``: metadados, series mensais do estado, populacao e mandatos.
* ``static-series/<indicador>.generated.json``: series por municipio e por area integrada
  (CISP) de um indicador, carregadas pelo frontend so quando o recorte pede.
* ``static-geo.generated.json``: geometrias (municipios e bairros do Rio), carregadas
  pelo frontend apenas na pagina de mapa.

``crime_geral`` e a soma de letalidade violenta, roubo de rua (em SP, roubo outros), de veiculo, de
carga e estupro; um mes so existe quando todos os componentes tem dado.

As series mensais sao esparsas: cada territorio tem ``{"from": "AAAA-MM", "values": [...]}``,
onde ``values`` comeca no primeiro mes com dado e pode conter ``null`` para meses em que o
indicador nao foi apurado. Isso evita confundir "sem dado" com "zero ocorrencias".
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
import zipfile
from calendar import monthrange
from datetime import date, datetime
from pathlib import Path
from typing import cast
from zoneinfo import ZoneInfo

import httpx
import pandas as pd

from app.config import settings
from app.constants import ANALYSIS_START_YEAR
from app.etl import ibge_http
from app.etl.extract import checksum_file
from app.etl.sources import default_isp_sources
from app.services import (
    brasil_repository,
    fogocruzado_repository,
    isp_repository,
    population_repository,
    sinesp_repository,
    ssp_repository,
)
from app.services.analytics import latest_period, methodology
from app.services.governor_performance import governor_performance, governor_terms, mayor_terms
from app.services.indicator_catalog import indicators_for
from app.services.territory_repository import ISP_TERRITORIAL_DIVISION_URL, territorial_units
from app.uf import all_ufs, current, repository, set_current

TERRITORY_TYPES = ("state", "municipality", "police_area")
GEO_PRECISION = 5  # ~1 m; o bastante para mapas coropleticos
FRONTEND_DIR = Path(__file__).resolve().parents[3] / "frontend"

IBGE_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/{uf}"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_RJ_MUNICIPALITIES_GEOJSON_URL = IBGE_MUNICIPALITIES_GEOJSON_URL.format(uf=33)
IBGE_UF_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF"
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

CRIME_GENERAL_CODE = "crime_geral"
# Componentes do crime geral por fonte. O ISP tem roubo de rua; a SSP-SP tem roubo (outros); o Sinesp
# VDE nao tem nenhum roubo de pessoa, entao o crime geral dessas UFs fica sem esse componente.
CRIME_GENERAL_COMPONENTS_BY_SOURCE = {
    "isp": ("letalidade_violenta", "roubo_rua", "roubo_veiculo", "roubo_carga", "estupro"),
    "ssp": ("letalidade_violenta", "roubo_outros", "roubo_veiculo", "roubo_carga", "estupro"),
    "sinesp": ("letalidade_violenta", "roubo_veiculo", "roubo_carga", "estupro"),
    "brasil": ("letalidade_violenta", "roubo_veiculo", "roubo_carga", "estupro"),
}
CRIME_GENERAL_COMPONENTS = CRIME_GENERAL_COMPONENTS_BY_SOURCE["isp"]


def crime_general_components() -> tuple[str, ...]:
    return CRIME_GENERAL_COMPONENTS_BY_SOURCE[current().source]


def default_output(uf: str) -> Path:
    return FRONTEND_DIR / "data" / uf.lower() / "static-data.generated.json"


def export_static_frontend(output_path: Path, geo_output_path: Path | None = None) -> None:
    uf = current()
    repo = repository()
    indicators = indicators_for(uf.source)
    latest = latest_period()
    month_keys = _month_keys(current().start_year, latest.year, latest.month)
    month_index = {key: index for index, key in enumerate(month_keys)}
    series, coverage = _series(month_keys, month_index)
    series[CRIME_GENERAL_CODE] = _crime_general(series, month_keys, month_index)
    generated_at = datetime.now(ZoneInfo("America/Sao_Paulo")).isoformat(timespec="seconds")

    snapshot = {
        "generated_at": generated_at,
        "analysis_start_year": current().start_year,
        "uf": uf.code,
        "name": uf.name,
        "latest_period": latest.model_dump(mode="json"),
        "month_keys": month_keys,
        "indicators": [indicator.model_dump(mode="json") for indicator in indicators],
        "crime_general_components": list(crime_general_components()),
        "territories": {
            territory_type: [
                {"territory_type": territory_type, "name": name}
                for name in repo.territories(territory_type)
            ]
            for territory_type in TERRITORY_TYPES
        },
        "territorial_units": _territorial_units(),
        "population_by_municipality": _population_by_municipality(),
        "population_history": _population_history(latest.year),
        "governor_terms": [
            {
                "governor": term.governor,
                "party_or_condition": term.party_or_condition,
                "term_start": term.start.isoformat(),
                "term_end": term.end.isoformat() if term.end else None,
            }
            for term in governor_terms()
        ],
        "mayor_terms": {
            municipality: [
                {
                    "governor": term.governor,
                    "party_or_condition": term.party_or_condition,
                    "term_start": term.start.isoformat(),
                    "term_end": term.end.isoformat() if term.end else None,
                }
                for term in terms
            ]
            for municipality, terms in mayor_terms().items()
        },
        "governor_performance": _governor_performance_payload(),
        "sources": _source_metadata(),
        "methodology": methodology(),
        # So o estado fica no snapshot principal; municipios e CISPs vao para um arquivo por
        # indicador, carregado pelo frontend quando o recorte pede.
        "series": {code: {"state": by_type.get("state", {})} for code, by_type in series.items()},
        "coverage": coverage,
    }
    if uf.source == "isp" and fogocruzado_repository.enabled():
        # Fonte opcional: so entra com ENABLE_FOGOCRUZADO=true e credenciais. Desligada, o
        # snapshot fica identico ao de sempre.
        section = fogocruzado_repository.static_section(
            isp_repository.territories("municipality"),
            _rio_neighborhood_names(),
        )
        # As series entram no mesmo esquema das do ISP, com o prefixo fc_: estado no snapshot
        # principal, municipios e bairros num arquivo por indicador.
        fogo_series = cast(dict[str, dict[str, dict[str, Series]]], section.pop("series"))
        for code, by_type in fogo_series.items():
            series[f"fc_{code}"] = by_type
        snapshot["fogo_cruzado"] = section
        snapshot["series"] = {code: {"state": by_type.get("state", {})} for code, by_type in series.items()}
    geo = {
        "generated_at": generated_at,
        "municipality_geometries": _round_collection(_municipality_geometries()),
        # O drill-down de bairros so existe no Rio; em SP nao ha geometria oficial das areas dos DPs.
        "rio_neighborhood_geometries": _round_collection(_rio_neighborhood_geometries())
        if uf.source == "isp"
        else {"type": "FeatureCollection", "features": []},
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(_dumps(snapshot), encoding="utf-8")
    geo_path = geo_output_path or output_path.with_name("static-geo.generated.json")
    geo_path.write_text(_dumps(geo), encoding="utf-8")
    _write_series_files(series, output_path.with_name("static-series"))


def _governor_performance_payload() -> dict[str, object]:
    payload = governor_performance().model_dump(mode="json")
    if current().source == "brasil":
        # O texto do calculo fala de governador e de dados estaduais; no Brasil sao presidentes e o total do pais.
        text = str(payload.get("methodology") or "")
        text = text.replace("dados mensais estaduais", "dados mensais nacionais").replace("governador", "presidente")
        payload["methodology"] = text.replace("do Sinesp VDE", "do Sinesp VDE (soma das 27 UFs)")
    return payload


def _write_series_files(series: SeriesStore, directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for stale in directory.glob("*.generated.json"):
        stale.unlink()
    for code, by_type in series.items():
        detail = {territory_type: values for territory_type, values in by_type.items() if territory_type != "state"}
        (directory / f"{code}.generated.json").write_text(_dumps(detail), encoding="utf-8")


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

    for indicator in indicators_for(current().source):
        result[indicator.code] = {}
        first_month[indicator.code] = {}
        for territory_type in TERRITORY_TYPES:
            frame = repository().rows(indicator.code, territory_type, start_year=current().start_year)
            result[indicator.code][territory_type] = _series_for_frame(frame, month_keys, month_index)
            first_month[indicator.code][territory_type] = _first_key(frame)
            last_key = _last_key(frame)
            if last_key and (latest_by_type.get(territory_type) or "") < last_key:
                latest_by_type[territory_type] = last_key

    # Ano inicial de municipios e areas: o da letalidade violenta (Rio); onde ela so existe para o
    # estado (SP, Sinesp), o do homicidio doloso.
    reference = first_month.get("letalidade_violenta", {})
    if not reference.get("municipality"):
        reference = first_month.get("homicidio_doloso", {})
    coverage: dict[str, object] = {
        "state_start_year": current().start_year,
        "municipality_start_year": _year_of(reference.get("municipality")),
        "police_area_start_year": _year_of(reference.get("police_area")),
        "latest_by_type": latest_by_type,
        "first_month_by_indicator": first_month,
        "map_drilldown": "rio_city" if current().source == "isp" else None,
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


def _crime_general(series: SeriesStore, month_keys: list[str], month_index: dict[str, int]) -> dict[str, dict[str, Series]]:
    """Sum the crime_geral components per territory; a month is null unless every component has data."""

    output: dict[str, dict[str, Series]] = {}
    for territory_type in TERRITORY_TYPES:
        components = [series.get(code, {}).get(territory_type, {}) for code in crime_general_components()]
        names = set(components[0])
        for component in components[1:]:
            names &= set(component)
        per_type: dict[str, Series] = {}
        for name in sorted(names):
            dense = [_dense(component[name], month_index, len(month_keys)) for component in components]
            values: list[float | None] = []
            for index in range(len(month_keys)):
                parts = [column[index] for column in dense]
                values.append(round(sum(cast_float(part) for part in parts), 1) if all(part is not None for part in parts) else None)
            present = [index for index, value in enumerate(values) if value is not None]
            if present:
                per_type[name] = {"from": month_keys[present[0]], "values": values[present[0]: present[-1] + 1]}
        output[territory_type] = per_type
    return output


def cast_float(value: float | None) -> float:
    return float(value) if value is not None else 0.0


def _dense(sparse: Series, month_index: dict[str, int], length: int) -> list[float | None]:
    dense: list[float | None] = [None] * length
    start = month_index.get(str(sparse["from"]), -1)
    if start >= 0:
        for offset, value in enumerate(cast(list[float | None], sparse["values"])):
            if start + offset < length:
                dense[start + offset] = value
    return dense


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


def _population_history(latest_year: int) -> dict[str, object]:
    start_year = current().start_year
    if current().source == "brasil":
        histories = population_repository.country_population_history(start_year, latest_year)
        return {
            "state": _population_history_payload(histories.get(str(current().ibge_code), {})),
            "municipality": {
                name: _population_history_payload(histories.get(str(all_ufs()[code].ibge_code), {}))
                for code, name in brasil_repository.uf_names().items()
            },
        }
    return {
        "state": _population_history_payload(population_repository.state_population_history(start_year, latest_year)),
        "municipality": {
            name: _population_history_payload(history)
            for name, history in population_repository.municipality_population_history(start_year, latest_year).items()
        },
    }


def _population_by_municipality() -> dict[str, float]:
    if current().source == "brasil":
        # Populacao de cada UF no ultimo ano com numero do IBGE (estimativa ou censo).
        histories = population_repository.country_population_history(current().start_year, date.today().year)
        output: dict[str, float] = {}
        for code, name in brasil_repository.uf_names().items():
            years = [year for year, row in histories.get(str(all_ufs()[code].ibge_code), {}).items() if not row["interpolated"]]
            if years:
                output[name] = float(histories[str(all_ufs()[code].ibge_code)][max(years)]["value"])
        return output
    populations: dict[str, float] = {}
    for name in repository().territories("municipality"):
        value = population_repository.population_for_municipality(municipality_name=name)
        if value is not None:
            populations[name] = float(value)
    return populations


def _population_history_payload(history: population_repository.PopulationHistory) -> dict[str, dict[str, object]]:
    return {str(year): {"value": row["value"], "interpolated": row["interpolated"]} for year, row in sorted(history.items())}


# --- Fontes ---------------------------------------------------------------------------------


def _territorial_units() -> list[dict[str, object]]:
    if current().source == "isp":
        return [dict(unit) for unit in territorial_units("Rio de Janeiro")]
    if current().source != "ssp":
        return []
    # SP: os distritos policiais numerados da capital, no mesmo formato das CISPs do Rio.
    units: list[dict[str, object]] = []
    for name in ssp_repository.territories("police_area"):
        head = name.split("º", 1)[0]
        units.append(
            {
                "name": name,
                "territorial_unit": name,
                "municipality": "São Paulo",
                "cisp": int(head) if head.isdigit() else 0,
                "police_area_name": name,
                "source_name": "SSP-SP - Distritos policiais",
            }
        )
    return sorted(units, key=lambda unit: int(str(unit["cisp"])))


def _source_metadata() -> list[dict[str, object]]:
    if current().source == "ssp":
        return _source_metadata_sp()
    if current().source == "sinesp":
        return _source_metadata_sinesp()
    if current().source == "brasil":
        return _source_metadata_brasil()
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
    if fogocruzado_repository.enabled():
        rows.append(fogocruzado_repository.source_row())
    return rows


def _source_metadata_sp() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ssp_dir = ssp_repository.raw_dir()
    rows = [
        _file_source_row("ssp_sp_monthly", ssp_repository.SSP_MONTHLY_URL, ssp_repository.consolidated_path(), "crime_stats"),
        _file_source_row("ssp_sp_municipalities", ssp_repository.SSP_MUNICIPALITIES_URL, raw_ssp_dir / "municipios.json", "territory"),
        _file_source_row("ssp_sp_police_districts", ssp_repository.SSP_DISTRICTS_URL, raw_ssp_dir / "distritos.json", "territory"),
    ]
    rows.append(_file_source_row("sinesp_vde_sp", sinesp_repository.VDE_PAGE_URL, sinesp_repository.extract_path("SP"), "crime_stats"))
    rows.append(
        _file_source_row(
            "ibge_population_municipalities_sp",
            "https://sidra.ibge.gov.br/tabela/6579",
            raw_ibge_dir / "population_municipalities_sp_latest.json",
            "population",
        )
    )
    for path in sorted(raw_ibge_dir.glob("population_*_sp_t*.json")):
        rows.append(_file_source_row(path.stem, "https://sidra.ibge.gov.br/", path, "population"))
    rows.append(
        _file_source_row(
            "ibge_municipality_geometries_sp",
            IBGE_MUNICIPALITIES_GEOJSON_URL.format(uf=35),
            raw_ibge_dir / "sp_municipalities_min.geojson",
            "geometry",
        )
    )
    return rows


def _source_metadata_sinesp() -> list[dict[str, object]]:
    uf = current()
    tag = uf.code.lower()
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    rows = [_file_source_row(f"sinesp_vde_{tag}", sinesp_repository.VDE_PAGE_URL, sinesp_repository.extract_path(uf.code), "crime_stats")]
    rows.append(
        _file_source_row(
            f"ibge_population_municipalities_{tag}",
            "https://sidra.ibge.gov.br/tabela/6579",
            raw_ibge_dir / f"population_municipalities_{tag}_latest.json",
            "population",
        )
    )
    for path in sorted(raw_ibge_dir.glob(f"population_*_{tag}_t*.json")):
        rows.append(_file_source_row(path.stem, "https://sidra.ibge.gov.br/", path, "population"))
    rows.append(
        _file_source_row(
            f"ibge_municipality_geometries_{tag}",
            IBGE_MUNICIPALITIES_GEOJSON_URL.format(uf=uf.ibge_code),
            raw_ibge_dir / f"{tag}_municipalities_min.geojson",
            "geometry",
        )
    )
    return rows


def _source_metadata_brasil() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    rows = [
        _file_source_row(f"sinesp_vde_{code.lower()}", sinesp_repository.VDE_PAGE_URL, sinesp_repository.extract_path(code), "crime_stats")
        for code in brasil_repository.uf_codes()
    ]
    for path in sorted(raw_ibge_dir.glob("population_country_*.json")):
        rows.append(_file_source_row(path.stem, "https://sidra.ibge.gov.br/", path, "population"))
    rows.append(_file_source_row("ibge_uf_geometries", IBGE_UF_GEOJSON_URL, raw_ibge_dir / "br_ufs_min.geojson", "geometry"))
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
    uf = current()
    if uf.source == "brasil":
        # Brasil: a malha das UFs (codarea = codigo IBGE da UF) no lugar da malha de municipios.
        path = _ensure_file("br_ufs_min.geojson", IBGE_UF_GEOJSON_URL)
    else:
        path = _ensure_file(f"{uf.code.lower()}_municipalities_min.geojson", IBGE_MUNICIPALITIES_GEOJSON_URL.format(uf=uf.ibge_code))
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


def _rio_neighborhood_names() -> list[str]:
    """Nomes dos bairros do Rio como grafados na malha da Prefeitura (usados no mapa)."""

    path = _ensure_file("rio_neighborhoods.geojson", RIO_NEIGHBORHOODS_GEOJSON_URL)
    data = json.loads(path.read_text(encoding="utf-8"))
    names: list[str] = []
    for feature in data.get("features", []):
        properties = feature.get("properties") or {}
        name = str(properties.get("nome") or "").strip()
        if name and name not in names:
            names.append(name)
    return names


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
    if current().source == "brasil":
        return {str(all_ufs()[code].ibge_code): name for code, name in brasil_repository.uf_names().items()}
    if current().source == "sinesp":
        return {code: name for code, name in sinesp_repository.municipality_official_names(current().code).values()}
    if current().source == "ssp":
        names = set(ssp_repository.territories("municipality"))
        return {code: name for name, code in ssp_repository.municipality_ibge_codes().items() if name in names}
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
    response = ibge_http.get(url, timeout=90) if "ibge.gov.br" in url else httpx.get(url, timeout=90, follow_redirects=True)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _normalize_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    without_marks = "".join(character for character in normalized if not unicodedata.combining(character))
    return re.sub(r"\s+", " ", without_marks.casefold()).strip()


def period_date(year: int, month: int) -> str:
    return date(year, month, monthrange(year, month)[1]).isoformat()


def main() -> int:
    """Export the snapshot of one UF and return a process exit status."""

    parser = argparse.ArgumentParser(description="Exporta o snapshot estatico de uma UF para o frontend.")
    parser.add_argument("--uf", default="RJ", help="sigla da UF (frontend/lib/ufs.json)")
    parser.add_argument("--output", type=Path, help="padrao: frontend/data/<uf>/static-data.generated.json")
    args = parser.parse_args()
    try:
        set_current(args.uf)
        output = args.output or default_output(args.uf)
        export_static_frontend(output)
    except Exception as error:  # ultimo recurso: so aqui, no topo
        print(f"Error: {error}", file=sys.stderr)
        return 1
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
