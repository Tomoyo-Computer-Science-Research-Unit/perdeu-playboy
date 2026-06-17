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
from app.etl.sinesp import SinespStateConfig, sinesp_source_metadata, sinesp_state_monthly_rows
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
IBGE_PR_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/41"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_PR_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/41/municipios"
IBGE_PR_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2041/v/9324/p/last"
IBGE_SC_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/42"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_SC_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/42/municipios"
IBGE_SC_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2042/v/9324/p/last"
IBGE_RS_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/43"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_RS_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/43/municipios"
IBGE_RS_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2043/v/9324/p/last"
IBGE_MG_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/31"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_MG_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/31/municipios"
IBGE_MG_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2031/v/9324/p/last"
IBGE_ES_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/32"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_ES_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/32/municipios"
IBGE_ES_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2032/v/9324/p/last"
IBGE_GO_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/52"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_GO_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/52/municipios"
IBGE_GO_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2052/v/9324/p/last"
IBGE_MT_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/51"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_MT_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/51/municipios"
IBGE_MT_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2051/v/9324/p/last"
IBGE_MS_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/50"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_MS_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/50/municipios"
IBGE_MS_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2050/v/9324/p/last"
IBGE_DF_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/53"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_DF_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/53/municipios"
IBGE_DF_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2053/v/9324/p/last"
IBGE_MA_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/21"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_MA_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/21/municipios"
IBGE_MA_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2021/v/9324/p/last"
IBGE_PI_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/22"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_PI_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/22/municipios"
IBGE_PI_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2022/v/9324/p/last"
IBGE_CE_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/23"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_CE_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/23/municipios"
IBGE_CE_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2023/v/9324/p/last"
IBGE_RN_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/24"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_RN_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/24/municipios"
IBGE_RN_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2024/v/9324/p/last"
IBGE_PB_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/25"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_PB_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/25/municipios"
IBGE_PB_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2025/v/9324/p/last"
IBGE_PE_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/26"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_PE_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/26/municipios"
IBGE_PE_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2026/v/9324/p/last"
IBGE_AL_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/27"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_AL_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/27/municipios"
IBGE_AL_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2027/v/9324/p/last"
IBGE_SE_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/28"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_SE_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/28/municipios"
IBGE_SE_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2028/v/9324/p/last"
IBGE_BA_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/29"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_BA_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/29/municipios"
IBGE_BA_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2029/v/9324/p/last"
IBGE_RO_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/11"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_RO_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/11/municipios"
IBGE_RO_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2011/v/9324/p/last"
IBGE_AC_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/12"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_AC_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/12/municipios"
IBGE_AC_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2012/v/9324/p/last"
IBGE_AM_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/13"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_AM_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/13/municipios"
IBGE_AM_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2013/v/9324/p/last"
IBGE_RR_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/14"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_RR_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/14/municipios"
IBGE_RR_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2014/v/9324/p/last"
IBGE_PA_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/15"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_PA_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/15/municipios"
IBGE_PA_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2015/v/9324/p/last"
IBGE_AP_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/16"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_AP_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/16/municipios"
IBGE_AP_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2016/v/9324/p/last"
IBGE_TO_MUNICIPALITIES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/17"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
IBGE_TO_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/17/municipios"
IBGE_TO_POPULATION_URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2017/v/9324/p/last"
IBGE_BRAZIL_STATES_GEOJSON_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF"
)
# IBGE 2-digit UF code -> (uf sigla, nome de exibicao) — deve casar com o campo "name"
# de cada payload estadual para alinhar geometria, series e populacao no agregado Brasil.
UF_BY_IBGE_CODE: dict[str, tuple[str, str]] = {
    "11": ("RO", "Rondônia"),
    "12": ("AC", "Acre"),
    "13": ("AM", "Amazonas"),
    "14": ("RR", "Roraima"),
    "15": ("PA", "Pará"),
    "16": ("AP", "Amapá"),
    "17": ("TO", "Tocantins"),
    "21": ("MA", "Maranhão"),
    "22": ("PI", "Piauí"),
    "23": ("CE", "Ceará"),
    "24": ("RN", "Rio Grande do Norte"),
    "25": ("PB", "Paraíba"),
    "26": ("PE", "Pernambuco"),
    "27": ("AL", "Alagoas"),
    "28": ("SE", "Sergipe"),
    "29": ("BA", "Bahia"),
    "31": ("MG", "Minas Gerais"),
    "32": ("ES", "Espírito Santo"),
    "33": ("RJ", "Rio de Janeiro"),
    "35": ("SP", "São Paulo"),
    "41": ("PR", "Paraná"),
    "42": ("SC", "Santa Catarina"),
    "43": ("RS", "Rio Grande do Sul"),
    "50": ("MS", "Mato Grosso do Sul"),
    "51": ("MT", "Mato Grosso"),
    "52": ("GO", "Goiás"),
    "53": ("DF", "Distrito Federal"),
}
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
    pr_state = _pr_state_payload(month_keys, month_index, latest.year, latest.month)
    sc_state = _sc_state_payload(month_keys, month_index, latest.year, latest.month)
    rs_state = _rs_state_payload(month_keys, month_index, latest.year, latest.month)
    mg_state = _mg_state_payload(month_keys, month_index, latest.year, latest.month)
    es_state = _es_state_payload(month_keys, month_index, latest.year, latest.month)
    go_state = _go_state_payload(month_keys, month_index, latest.year, latest.month)
    mt_state = _mt_state_payload(month_keys, month_index, latest.year, latest.month)
    ms_state = _ms_state_payload(month_keys, month_index, latest.year, latest.month)
    df_state = _df_state_payload(month_keys, month_index, latest.year, latest.month)
    ma_state = _ma_state_payload(month_keys, month_index, latest.year, latest.month)
    pi_state = _pi_state_payload(month_keys, month_index, latest.year, latest.month)
    ce_state = _ce_state_payload(month_keys, month_index, latest.year, latest.month)
    rn_state = _rn_state_payload(month_keys, month_index, latest.year, latest.month)
    pb_state = _pb_state_payload(month_keys, month_index, latest.year, latest.month)
    pe_state = _pe_state_payload(month_keys, month_index, latest.year, latest.month)
    al_state = _al_state_payload(month_keys, month_index, latest.year, latest.month)
    se_state = _se_state_payload(month_keys, month_index, latest.year, latest.month)
    ba_state = _ba_state_payload(month_keys, month_index, latest.year, latest.month)
    ro_state = _ro_state_payload(month_keys, month_index, latest.year, latest.month)
    ac_state = _ac_state_payload(month_keys, month_index, latest.year, latest.month)
    am_state = _am_state_payload(month_keys, month_index, latest.year, latest.month)
    rr_state = _rr_state_payload(month_keys, month_index, latest.year, latest.month)
    pa_state = _pa_state_payload(month_keys, month_index, latest.year, latest.month)
    ap_state = _ap_state_payload(month_keys, month_index, latest.year, latest.month)
    to_state = _to_state_payload(month_keys, month_index, latest.year, latest.month)

    snapshot = {
        "generated_at": datetime.now(ZoneInfo("America/Sao_Paulo")).isoformat(timespec="seconds"),
        "analysis_start_year": ANALYSIS_START_YEAR,
        "latest_period": latest.model_dump(mode="json"),
        "month_keys": month_keys,
        **rj_state,
        "governor_performance": governor_performance().model_dump(mode="json"),
        "brazil_state_geometries": _brazil_state_geometries(),
        "states": {
            "RJ": rj_state,
            "SP": sp_state,
            "PR": pr_state,
            "SC": sc_state,
            "RS": rs_state,
            "MG": mg_state,
            "ES": es_state,
            "GO": go_state,
            "MT": mt_state,
            "MS": ms_state,
            "DF": df_state,
            "MA": ma_state,
            "PI": pi_state,
            "CE": ce_state,
            "RN": rn_state,
            "PB": pb_state,
            "PE": pe_state,
            "AL": al_state,
            "SE": se_state,
            "BA": ba_state,
            "RO": ro_state,
            "AC": ac_state,
            "AM": am_state,
            "RR": rr_state,
            "PA": pa_state,
            "AP": ap_state,
            "TO": to_state,
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


def _pr_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _pr_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="PR", state_name="Estado do Paraná", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    pr_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "PR",
        "name": "Paraná",
        "latest_period": pr_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado do Paraná"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _pr_population_by_municipality(),
        "municipality_geometries": _pr_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("PR") + _pr_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Paraná usa o Sinesp VDE/MJSP para séries mensais por estado e, quando disponível, por município. "
                "Alguns indicadores são publicados apenas em abrangência estadual no VDE."
            ),
            "limitations": [
                "PR começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para PR porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para PR nesta versão; o nível subestadual é municipal.",
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


def _sc_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _sc_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="SC", state_name="Estado de Santa Catarina", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    sc_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "SC",
        "name": "Santa Catarina",
        "latest_period": sc_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado de Santa Catarina"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _sc_population_by_municipality(),
        "municipality_geometries": _sc_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("SC") + _sc_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Santa Catarina usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "SC começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para SC porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para SC nesta versão; o nível subestadual é municipal.",
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


def _rs_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _rs_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="RS", state_name="Estado do Rio Grande do Sul", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    rs_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "RS",
        "name": "Rio Grande do Sul",
        "latest_period": rs_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado do Rio Grande do Sul"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _rs_population_by_municipality(),
        "municipality_geometries": _rs_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("RS") + _rs_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Rio Grande do Sul usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "RS começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para RS porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para RS nesta versão; o nível subestadual é municipal.",
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


def _mg_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _mg_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="MG", state_name="Estado de Minas Gerais", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    mg_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "MG",
        "name": "Minas Gerais",
        "latest_period": mg_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado de Minas Gerais"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _mg_population_by_municipality(),
        "municipality_geometries": _mg_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("MG") + _mg_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Minas Gerais usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "MG começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para MG porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para MG nesta versão; o nível subestadual é municipal.",
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


def _es_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _es_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="ES", state_name="Estado do Espírito Santo", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    es_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "ES",
        "name": "Espírito Santo",
        "latest_period": es_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado do Espírito Santo"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _es_population_by_municipality(),
        "municipality_geometries": _es_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("ES") + _es_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Espírito Santo usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "ES começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para ES porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para ES nesta versão; o nível subestadual é municipal.",
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


def _go_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _go_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="GO", state_name="Estado de Goiás", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    go_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "GO",
        "name": "Goiás",
        "latest_period": go_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado de Goiás"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _go_population_by_municipality(),
        "municipality_geometries": _go_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("GO") + _go_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Goiás usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "GO começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para GO porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para GO nesta versão; o nível subestadual é municipal.",
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


def _mt_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _mt_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="MT", state_name="Estado de Mato Grosso", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    mt_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "MT",
        "name": "Mato Grosso",
        "latest_period": mt_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado de Mato Grosso"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _mt_population_by_municipality(),
        "municipality_geometries": _mt_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("MT") + _mt_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Mato Grosso usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "MT começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para MT porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para MT nesta versão; o nível subestadual é municipal.",
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


def _ms_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _ms_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="MS", state_name="Estado de Mato Grosso do Sul", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    ms_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "MS",
        "name": "Mato Grosso do Sul",
        "latest_period": ms_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado de Mato Grosso do Sul"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _ms_population_by_municipality(),
        "municipality_geometries": _ms_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("MS") + _ms_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Mato Grosso do Sul usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "MS começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para MS porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para MS nesta versão; o nível subestadual é municipal.",
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


def _df_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _df_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="DF", state_name="Distrito Federal", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    df_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "DF",
        "name": "Distrito Federal",
        "latest_period": df_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Distrito Federal"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _df_population_by_municipality(),
        "municipality_geometries": _df_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("DF") + _df_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Distrito Federal usa o Sinesp VDE/MJSP para séries mensais. O DF é uma unidade "
                "federativa de município único, então o nível estadual e o municipal coincidem em Brasília."
            ),
            "limitations": [
                "DF começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para DF porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "O DF tem município único (Brasília); não há divisão por CISP/bairro nesta versão.",
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


def _ma_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _ma_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="MA", state_name="Estado do Maranhão", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    ma_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "MA",
        "name": "Maranhão",
        "latest_period": ma_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado do Maranhão"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _ma_population_by_municipality(),
        "municipality_geometries": _ma_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("MA") + _ma_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Maranhão usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "MA começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para MA porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para MA nesta versão; o nível subestadual é municipal.",
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


def _pi_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _pi_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="PI", state_name="Estado do Piauí", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    pi_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "PI",
        "name": "Piauí",
        "latest_period": pi_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado do Piauí"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _pi_population_by_municipality(),
        "municipality_geometries": _pi_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("PI") + _pi_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Piauí usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "PI começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para PI porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para PI nesta versão; o nível subestadual é municipal.",
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


def _ce_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _ce_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="CE", state_name="Estado do Ceará", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    ce_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "CE",
        "name": "Ceará",
        "latest_period": ce_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado do Ceará"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _ce_population_by_municipality(),
        "municipality_geometries": _ce_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("CE") + _ce_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Ceará usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "CE começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para CE porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para CE nesta versão; o nível subestadual é municipal.",
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


def _rn_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _rn_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="RN", state_name="Estado do Rio Grande do Norte", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    rn_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "RN",
        "name": "Rio Grande do Norte",
        "latest_period": rn_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado do Rio Grande do Norte"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _rn_population_by_municipality(),
        "municipality_geometries": _rn_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("RN") + _rn_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Rio Grande do Norte usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "RN começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para RN porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para RN nesta versão; o nível subestadual é municipal.",
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


def _pb_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _pb_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="PB", state_name="Estado da Paraíba", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    pb_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "PB",
        "name": "Paraíba",
        "latest_period": pb_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado da Paraíba"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _pb_population_by_municipality(),
        "municipality_geometries": _pb_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("PB") + _pb_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Paraíba usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "PB começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para PB porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para PB nesta versão; o nível subestadual é municipal.",
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


def _pe_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _pe_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="PE", state_name="Estado de Pernambuco", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    pe_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "PE",
        "name": "Pernambuco",
        "latest_period": pe_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado de Pernambuco"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _pe_population_by_municipality(),
        "municipality_geometries": _pe_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("PE") + _pe_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Pernambuco usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "PE começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para PE porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para PE nesta versão; o nível subestadual é municipal.",
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


def _al_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _al_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="AL", state_name="Estado de Alagoas", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    al_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "AL",
        "name": "Alagoas",
        "latest_period": al_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado de Alagoas"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _al_population_by_municipality(),
        "municipality_geometries": _al_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("AL") + _al_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Alagoas usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "AL começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para AL porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para AL nesta versão; o nível subestadual é municipal.",
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


def _se_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _se_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="SE", state_name="Estado de Sergipe", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    se_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "SE",
        "name": "Sergipe",
        "latest_period": se_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado de Sergipe"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _se_population_by_municipality(),
        "municipality_geometries": _se_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("SE") + _se_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Sergipe usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "SE começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para SE porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para SE nesta versão; o nível subestadual é municipal.",
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


def _ba_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _ba_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="BA", state_name="Estado da Bahia", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    ba_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "BA",
        "name": "Bahia",
        "latest_period": ba_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado da Bahia"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _ba_population_by_municipality(),
        "municipality_geometries": _ba_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("BA") + _ba_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Bahia usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "BA começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para BA porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para BA nesta versão; o nível subestadual é municipal.",
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


def _ro_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _ro_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="RO", state_name="Estado de Rondônia", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    ro_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "RO",
        "name": "Rondônia",
        "latest_period": ro_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado de Rondônia"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _ro_population_by_municipality(),
        "municipality_geometries": _ro_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("RO") + _ro_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Rondônia usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "RO começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para RO porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para RO nesta versão; o nível subestadual é municipal.",
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


def _ac_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _ac_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="AC", state_name="Estado do Acre", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    ac_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "AC",
        "name": "Acre",
        "latest_period": ac_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado do Acre"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _ac_population_by_municipality(),
        "municipality_geometries": _ac_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("AC") + _ac_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Acre usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "AC começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para AC porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para AC nesta versão; o nível subestadual é municipal.",
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


def _am_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _am_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="AM", state_name="Estado do Amazonas", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    am_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "AM",
        "name": "Amazonas",
        "latest_period": am_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado do Amazonas"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _am_population_by_municipality(),
        "municipality_geometries": _am_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("AM") + _am_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Amazonas usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "AM começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para AM porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para AM nesta versão; o nível subestadual é municipal.",
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


def _rr_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _rr_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="RR", state_name="Estado de Roraima", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    rr_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "RR",
        "name": "Roraima",
        "latest_period": rr_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado de Roraima"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _rr_population_by_municipality(),
        "municipality_geometries": _rr_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("RR") + _rr_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Roraima usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "RR começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para RR porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para RR nesta versão; o nível subestadual é municipal.",
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


def _pa_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _pa_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="PA", state_name="Estado do Pará", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    pa_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "PA",
        "name": "Pará",
        "latest_period": pa_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado do Pará"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _pa_population_by_municipality(),
        "municipality_geometries": _pa_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("PA") + _pa_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Pará usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "PA começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para PA porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para PA nesta versão; o nível subestadual é municipal.",
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


def _ap_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _ap_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="AP", state_name="Estado do Amapá", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    ap_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "AP",
        "name": "Amapá",
        "latest_period": ap_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado do Amapá"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _ap_population_by_municipality(),
        "municipality_geometries": _ap_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("AP") + _ap_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Amapá usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "AP começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para AP porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para AP nesta versão; o nível subestadual é municipal.",
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


def _to_state_payload(
    month_keys: list[str],
    month_index: dict[str, int],
    latest_year: int,
    latest_month: int,
) -> dict[str, object]:
    municipalities = _to_municipality_code_to_name()
    normalized_names = {_normalize_name(name): name for name in municipalities.values()}
    frame = sinesp_state_monthly_rows(
        SinespStateConfig(uf="TO", state_name="Estado do Tocantins", start_year=2015),
        normalized_names,
        latest_year,
        latest_month,
    )
    latest_row = frame.sort_values(["year", "month"]).iloc[-1]
    to_latest = {
        "year": int(latest_row["year"]),
        "month": int(latest_row["month"]),
        "period_date": period_date(int(latest_row["year"]), int(latest_row["month"])),
        "source_name": "Sinesp VDE/MJSP",
    }
    return {
        "uf": "TO",
        "name": "Tocantins",
        "latest_period": to_latest,
        "indicators": [indicator.model_dump(mode="json") for indicator in INDICATORS],
        "territories": {
            "state": [{"territory_type": "state", "name": "Estado do Tocantins"}],
            "municipality": [
                {"territory_type": "municipality", "name": name}
                for name in sorted(municipalities.values())
            ],
            "police_area": [],
        },
        "territorial_units": [],
        "population_by_municipality": _to_population_by_municipality(),
        "municipality_geometries": _to_municipality_geometries(),
        "rio_neighborhood_geometries": {"type": "FeatureCollection", "features": []},
        "sources": sinesp_source_metadata("TO") + _to_ibge_source_metadata(),
        "methodology": {
            **methodology(),
            "source_summary": (
                "Tocantins usa o Sinesp VDE/MJSP para séries mensais por estado e, "
                "quando disponível, por município. Alguns indicadores são publicados apenas "
                "em abrangência estadual no VDE."
            ),
            "limitations": [
                "TO começa em 2015 nesta integração porque o VDE cobre 2015-2026.",
                "Roubo de rua não é exibido para TO porque o VDE não publica uma rubrica municipal compatível.",
                "Roubo de veículo, roubo de carga, estupro e armas apreendidas aparecem no VDE em abrangência estadual.",
                "Não há divisão por CISP/bairro para TO nesta versão; o nível subestadual é municipal.",
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


def _pr_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_pr",
            IBGE_PR_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_pr_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_pr",
            IBGE_PR_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "pr_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_pr",
            IBGE_PR_MUNICIPALITIES_URL,
            raw_ibge_dir / "pr_municipalities.json",
            "territory",
        ),
    ]


def _sc_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_sc",
            IBGE_SC_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_sc_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_sc",
            IBGE_SC_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "sc_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_sc",
            IBGE_SC_MUNICIPALITIES_URL,
            raw_ibge_dir / "sc_municipalities.json",
            "territory",
        ),
    ]


def _rs_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_rs",
            IBGE_RS_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_rs_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_rs",
            IBGE_RS_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "rs_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_rs",
            IBGE_RS_MUNICIPALITIES_URL,
            raw_ibge_dir / "rs_municipalities.json",
            "territory",
        ),
    ]


def _mg_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_mg",
            IBGE_MG_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_mg_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_mg",
            IBGE_MG_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "mg_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_mg",
            IBGE_MG_MUNICIPALITIES_URL,
            raw_ibge_dir / "mg_municipalities.json",
            "territory",
        ),
    ]


def _es_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_es",
            IBGE_ES_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_es_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_es",
            IBGE_ES_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "es_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_es",
            IBGE_ES_MUNICIPALITIES_URL,
            raw_ibge_dir / "es_municipalities.json",
            "territory",
        ),
    ]


def _go_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_go",
            IBGE_GO_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_go_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_go",
            IBGE_GO_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "go_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_go",
            IBGE_GO_MUNICIPALITIES_URL,
            raw_ibge_dir / "go_municipalities.json",
            "territory",
        ),
    ]


def _mt_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_mt",
            IBGE_MT_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_mt_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_mt",
            IBGE_MT_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "mt_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_mt",
            IBGE_MT_MUNICIPALITIES_URL,
            raw_ibge_dir / "mt_municipalities.json",
            "territory",
        ),
    ]


def _ms_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_ms",
            IBGE_MS_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_ms_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_ms",
            IBGE_MS_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "ms_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_ms",
            IBGE_MS_MUNICIPALITIES_URL,
            raw_ibge_dir / "ms_municipalities.json",
            "territory",
        ),
    ]


def _df_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_df",
            IBGE_DF_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_df_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_df",
            IBGE_DF_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "df_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_df",
            IBGE_DF_MUNICIPALITIES_URL,
            raw_ibge_dir / "df_municipalities.json",
            "territory",
        ),
    ]


def _ma_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_ma",
            IBGE_MA_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_ma_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_ma",
            IBGE_MA_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "ma_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_ma",
            IBGE_MA_MUNICIPALITIES_URL,
            raw_ibge_dir / "ma_municipalities.json",
            "territory",
        ),
    ]


def _pi_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_pi",
            IBGE_PI_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_pi_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_pi",
            IBGE_PI_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "pi_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_pi",
            IBGE_PI_MUNICIPALITIES_URL,
            raw_ibge_dir / "pi_municipalities.json",
            "territory",
        ),
    ]


def _ce_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_ce",
            IBGE_CE_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_ce_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_ce",
            IBGE_CE_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "ce_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_ce",
            IBGE_CE_MUNICIPALITIES_URL,
            raw_ibge_dir / "ce_municipalities.json",
            "territory",
        ),
    ]


def _rn_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_rn",
            IBGE_RN_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_rn_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_rn",
            IBGE_RN_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "rn_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_rn",
            IBGE_RN_MUNICIPALITIES_URL,
            raw_ibge_dir / "rn_municipalities.json",
            "territory",
        ),
    ]


def _pb_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_pb",
            IBGE_PB_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_pb_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_pb",
            IBGE_PB_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "pb_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_pb",
            IBGE_PB_MUNICIPALITIES_URL,
            raw_ibge_dir / "pb_municipalities.json",
            "territory",
        ),
    ]


def _pe_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_pe",
            IBGE_PE_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_pe_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_pe",
            IBGE_PE_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "pe_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_pe",
            IBGE_PE_MUNICIPALITIES_URL,
            raw_ibge_dir / "pe_municipalities.json",
            "territory",
        ),
    ]


def _al_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_al",
            IBGE_AL_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_al_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_al",
            IBGE_AL_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "al_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_al",
            IBGE_AL_MUNICIPALITIES_URL,
            raw_ibge_dir / "al_municipalities.json",
            "territory",
        ),
    ]


def _se_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_se",
            IBGE_SE_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_se_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_se",
            IBGE_SE_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "se_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_se",
            IBGE_SE_MUNICIPALITIES_URL,
            raw_ibge_dir / "se_municipalities.json",
            "territory",
        ),
    ]


def _ba_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_ba",
            IBGE_BA_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_ba_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_ba",
            IBGE_BA_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "ba_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_ba",
            IBGE_BA_MUNICIPALITIES_URL,
            raw_ibge_dir / "ba_municipalities.json",
            "territory",
        ),
    ]


def _ro_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_ro",
            IBGE_RO_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_ro_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_ro",
            IBGE_RO_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "ro_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_ro",
            IBGE_RO_MUNICIPALITIES_URL,
            raw_ibge_dir / "ro_municipalities.json",
            "territory",
        ),
    ]


def _ac_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_ac",
            IBGE_AC_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_ac_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_ac",
            IBGE_AC_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "ac_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_ac",
            IBGE_AC_MUNICIPALITIES_URL,
            raw_ibge_dir / "ac_municipalities.json",
            "territory",
        ),
    ]


def _am_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_am",
            IBGE_AM_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_am_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_am",
            IBGE_AM_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "am_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_am",
            IBGE_AM_MUNICIPALITIES_URL,
            raw_ibge_dir / "am_municipalities.json",
            "territory",
        ),
    ]


def _rr_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_rr",
            IBGE_RR_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_rr_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_rr",
            IBGE_RR_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "rr_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_rr",
            IBGE_RR_MUNICIPALITIES_URL,
            raw_ibge_dir / "rr_municipalities.json",
            "territory",
        ),
    ]


def _pa_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_pa",
            IBGE_PA_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_pa_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_pa",
            IBGE_PA_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "pa_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_pa",
            IBGE_PA_MUNICIPALITIES_URL,
            raw_ibge_dir / "pa_municipalities.json",
            "territory",
        ),
    ]


def _ap_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_ap",
            IBGE_AP_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_ap_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_ap",
            IBGE_AP_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "ap_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_ap",
            IBGE_AP_MUNICIPALITIES_URL,
            raw_ibge_dir / "ap_municipalities.json",
            "territory",
        ),
    ]


def _to_ibge_source_metadata() -> list[dict[str, object]]:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    return [
        _file_source_row(
            "ibge_population_municipalities_to",
            IBGE_TO_POPULATION_URL,
            raw_ibge_dir / "population_municipalities_to_latest.json",
            "population",
        ),
        _file_source_row(
            "ibge_municipality_geometries_to",
            IBGE_TO_MUNICIPALITIES_GEOJSON_URL,
            raw_ibge_dir / "to_municipalities_min.geojson",
            "geometry",
        ),
        _file_source_row(
            "ibge_municipality_names_to",
            IBGE_TO_MUNICIPALITIES_URL,
            raw_ibge_dir / "to_municipalities.json",
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


def _pr_municipality_geometries() -> dict[str, object]:
    path = _ensure_pr_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _pr_municipality_code_to_name()
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


def _sc_municipality_geometries() -> dict[str, object]:
    path = _ensure_sc_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _sc_municipality_code_to_name()
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


def _rs_municipality_geometries() -> dict[str, object]:
    path = _ensure_rs_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _rs_municipality_code_to_name()
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


def _mg_municipality_geometries() -> dict[str, object]:
    path = _ensure_mg_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _mg_municipality_code_to_name()
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


def _es_municipality_geometries() -> dict[str, object]:
    path = _ensure_es_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _es_municipality_code_to_name()
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


def _go_municipality_geometries() -> dict[str, object]:
    path = _ensure_go_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _go_municipality_code_to_name()
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


def _mt_municipality_geometries() -> dict[str, object]:
    path = _ensure_mt_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _mt_municipality_code_to_name()
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


def _ms_municipality_geometries() -> dict[str, object]:
    path = _ensure_ms_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _ms_municipality_code_to_name()
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


def _df_municipality_geometries() -> dict[str, object]:
    path = _ensure_df_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _df_municipality_code_to_name()
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


def _ma_municipality_geometries() -> dict[str, object]:
    path = _ensure_ma_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _ma_municipality_code_to_name()
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


def _pi_municipality_geometries() -> dict[str, object]:
    path = _ensure_pi_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _pi_municipality_code_to_name()
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


def _ce_municipality_geometries() -> dict[str, object]:
    path = _ensure_ce_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _ce_municipality_code_to_name()
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


def _rn_municipality_geometries() -> dict[str, object]:
    path = _ensure_rn_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _rn_municipality_code_to_name()
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


def _pb_municipality_geometries() -> dict[str, object]:
    path = _ensure_pb_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _pb_municipality_code_to_name()
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


def _pe_municipality_geometries() -> dict[str, object]:
    path = _ensure_pe_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _pe_municipality_code_to_name()
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


def _al_municipality_geometries() -> dict[str, object]:
    path = _ensure_al_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _al_municipality_code_to_name()
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


def _se_municipality_geometries() -> dict[str, object]:
    path = _ensure_se_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _se_municipality_code_to_name()
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


def _ba_municipality_geometries() -> dict[str, object]:
    path = _ensure_ba_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _ba_municipality_code_to_name()
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


def _ro_municipality_geometries() -> dict[str, object]:
    path = _ensure_ro_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _ro_municipality_code_to_name()
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


def _ac_municipality_geometries() -> dict[str, object]:
    path = _ensure_ac_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _ac_municipality_code_to_name()
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


def _am_municipality_geometries() -> dict[str, object]:
    path = _ensure_am_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _am_municipality_code_to_name()
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


def _rr_municipality_geometries() -> dict[str, object]:
    path = _ensure_rr_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _rr_municipality_code_to_name()
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


def _pa_municipality_geometries() -> dict[str, object]:
    path = _ensure_pa_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _pa_municipality_code_to_name()
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


def _ap_municipality_geometries() -> dict[str, object]:
    path = _ensure_ap_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _ap_municipality_code_to_name()
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


def _to_municipality_geometries() -> dict[str, object]:
    path = _ensure_to_municipality_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    code_to_name = _to_municipality_code_to_name()
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


def _brazil_state_geometries() -> dict[str, object]:
    path = _ensure_brazil_states_geometries_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    features = []
    for feature in data.get("features", []):
        properties = feature.get("properties") or {}
        ibge_code = str(properties.get("codarea") or "")
        mapping = UF_BY_IBGE_CODE.get(ibge_code)
        if not mapping:
            continue
        uf, name = mapping
        features.append(
            {
                "type": "Feature",
                "geometry": feature.get("geometry"),
                "properties": {
                    "ibge_code": ibge_code,
                    "uf": uf,
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


def _ensure_pr_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "pr_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_PR_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_pr_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "pr_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_PR_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_pr_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_pr_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_PR_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_sc_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "sc_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_SC_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_sc_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "sc_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_SC_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_sc_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_sc_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_SC_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_rs_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "rs_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_RS_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_rs_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "rs_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_RS_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_rs_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_rs_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_RS_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_mg_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "mg_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_MG_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_mg_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "mg_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_MG_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_mg_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_mg_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_MG_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_es_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "es_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_ES_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_es_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "es_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_ES_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_es_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_es_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_ES_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_go_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "go_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_GO_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_go_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "go_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_GO_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_go_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_go_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_GO_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_mt_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "mt_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_MT_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_mt_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "mt_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_MT_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_mt_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_mt_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_MT_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_ms_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "ms_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_MS_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_ms_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "ms_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_MS_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_ms_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_ms_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_MS_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_df_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "df_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_DF_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_df_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "df_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_DF_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_df_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_df_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_DF_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_ma_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "ma_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_MA_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_ma_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "ma_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_MA_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_ma_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_ma_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_MA_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_pi_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "pi_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_PI_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_pi_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "pi_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_PI_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_pi_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_pi_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_PI_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_ce_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "ce_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_CE_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_ce_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "ce_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_CE_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_ce_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_ce_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_CE_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_rn_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "rn_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_RN_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_rn_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "rn_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_RN_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_rn_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_rn_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_RN_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_pb_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "pb_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_PB_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_pb_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "pb_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_PB_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_pb_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_pb_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_PB_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_pe_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "pe_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_PE_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_pe_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "pe_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_PE_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_pe_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_pe_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_PE_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_al_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "al_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_AL_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_al_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "al_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_AL_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_al_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_al_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_AL_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_se_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "se_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_SE_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_se_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "se_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_SE_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_se_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_se_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_SE_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_ba_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "ba_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_BA_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_ba_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "ba_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_BA_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_ba_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_ba_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_BA_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_ro_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "ro_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_RO_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_ro_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "ro_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_RO_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_ro_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_ro_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_RO_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_ac_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "ac_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_AC_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_ac_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "ac_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_AC_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_ac_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_ac_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_AC_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_am_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "am_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_AM_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_am_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "am_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_AM_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_am_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_am_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_AM_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_rr_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "rr_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_RR_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_rr_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "rr_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_RR_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_rr_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_rr_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_RR_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_pa_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "pa_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_PA_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_pa_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "pa_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_PA_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_pa_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_pa_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_PA_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_ap_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "ap_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_AP_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_ap_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "ap_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_AP_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_ap_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_ap_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_AP_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_to_municipality_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "to_municipalities_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_TO_MUNICIPALITIES_GEOJSON_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_to_municipality_names_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "to_municipalities.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_TO_MUNICIPALITIES_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_to_population_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "population_municipalities_to_latest.json"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_TO_POPULATION_URL, timeout=90)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _ensure_brazil_states_geometries_file() -> Path:
    raw_ibge_dir = settings.data_dir / "raw" / "ibge"
    raw_ibge_dir.mkdir(parents=True, exist_ok=True)
    path = raw_ibge_dir / "brazil_states_min.geojson"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(IBGE_BRAZIL_STATES_GEOJSON_URL, timeout=90)
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


def _pr_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_pr_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _sc_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_sc_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _rs_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_rs_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _mg_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_mg_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _es_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_es_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _go_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_go_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _mt_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_mt_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _ms_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_ms_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _df_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_df_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _ma_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_ma_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _pi_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_pi_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _ce_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_ce_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _rn_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_rn_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _pb_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_pb_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _pe_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_pe_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _al_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_al_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _se_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_se_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _ba_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_ba_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _ro_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_ro_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _ac_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_ac_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _am_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_am_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _rr_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_rr_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _pa_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_pa_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _ap_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_ap_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _to_municipality_code_to_name() -> dict[str, str]:
    path = _ensure_to_municipality_names_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["nome"]) for row in rows if row.get("id") and row.get("nome")}


def _pr_population_by_municipality() -> dict[str, float]:
    path = _ensure_pr_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+PR$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _sc_population_by_municipality() -> dict[str, float]:
    path = _ensure_sc_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+SC$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _rs_population_by_municipality() -> dict[str, float]:
    path = _ensure_rs_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+RS$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _mg_population_by_municipality() -> dict[str, float]:
    path = _ensure_mg_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+MG$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _es_population_by_municipality() -> dict[str, float]:
    path = _ensure_es_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+ES$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _go_population_by_municipality() -> dict[str, float]:
    path = _ensure_go_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+GO$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _mt_population_by_municipality() -> dict[str, float]:
    path = _ensure_mt_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+MT$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _ms_population_by_municipality() -> dict[str, float]:
    path = _ensure_ms_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+MS$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _df_population_by_municipality() -> dict[str, float]:
    path = _ensure_df_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+DF$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _ma_population_by_municipality() -> dict[str, float]:
    path = _ensure_ma_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+MA$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _pi_population_by_municipality() -> dict[str, float]:
    path = _ensure_pi_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+PI$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _ce_population_by_municipality() -> dict[str, float]:
    path = _ensure_ce_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+CE$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _rn_population_by_municipality() -> dict[str, float]:
    path = _ensure_rn_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+RN$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _pb_population_by_municipality() -> dict[str, float]:
    path = _ensure_pb_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+PB$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _pe_population_by_municipality() -> dict[str, float]:
    path = _ensure_pe_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+PE$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _al_population_by_municipality() -> dict[str, float]:
    path = _ensure_al_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+AL$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _se_population_by_municipality() -> dict[str, float]:
    path = _ensure_se_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+SE$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _ba_population_by_municipality() -> dict[str, float]:
    path = _ensure_ba_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+BA$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _ro_population_by_municipality() -> dict[str, float]:
    path = _ensure_ro_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+RO$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _ac_population_by_municipality() -> dict[str, float]:
    path = _ensure_ac_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+AC$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _am_population_by_municipality() -> dict[str, float]:
    path = _ensure_am_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+AM$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _rr_population_by_municipality() -> dict[str, float]:
    path = _ensure_rr_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+RR$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _pa_population_by_municipality() -> dict[str, float]:
    path = _ensure_pa_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+PA$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _ap_population_by_municipality() -> dict[str, float]:
    path = _ensure_ap_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+AP$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


def _to_population_by_municipality() -> dict[str, float]:
    path = _ensure_to_population_file()
    rows = json.loads(path.read_text(encoding="utf-8"))
    output: dict[str, float] = {}
    for row in rows[1:]:
        name = re.sub(r"\s+-\s+TO$", "", str(row.get("D1N", "")).strip())
        value = row.get("V")
        if not name or value in {None, "", "-"}:
            continue
        output[name] = float(str(value).replace(".", "").replace(",", "."))
    return output


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
