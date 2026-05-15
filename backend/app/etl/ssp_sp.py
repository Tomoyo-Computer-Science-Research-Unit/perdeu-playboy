from __future__ import annotations

import asyncio
import json
import re
import unicodedata
import zipfile
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

import httpx
import pandas as pd

from app.config import settings

SSP_SP_API_BASE_URL = "https://www.ssp.sp.gov.br"
SSP_SP_MONTHLY_ENDPOINT = (
    f"{SSP_SP_API_BASE_URL}/v1/OcorrenciasMensais/RecuperaDadosMensaisAgrupados"
)
SSP_SP_MUNICIPALITIES_URL = f"{SSP_SP_API_BASE_URL}/v1/Municipios/RecuperaMunicipios"
SINESP_VDE_URL = (
    "https://dados.mj.gov.br/dataset/210b9ae2-21fc-4986-89c6-2006eb4db247/"
    "resource/e9d6cc2b-33f1-468d-ab09-9aa8303c2eba/download/basededadosvde.zip"
)

MONTH_COLUMNS = {
    "janeiro": 1,
    "fevereiro": 2,
    "marco": 3,
    "abril": 4,
    "maio": 5,
    "junho": 6,
    "julho": 7,
    "agosto": 8,
    "setembro": 9,
    "outubro": 10,
    "novembro": 11,
    "dezembro": 12,
}

SSP_INDICATOR_BY_DELITO = {
    "HOMICIDIO DOLOSO": "homicidio_doloso",
    "LESAO CORPORAL SEGUIDA DE MORTE": "lesao_corp_morte",
    "LATROCINIO": "latrocinio",
    "TOTAL DE ESTUPRO": "estupro",
    "ROUBO - OUTROS": "roubo_rua",
    "ROUBO DE VEICULO": "roubo_veiculo",
    "ROUBO DE CARGA": "roubo_carga",
    "NO DE ARMAS DE FOGO APREENDIDAS": "apreensao_armas",
}

SINESP_INDICATOR_BY_EVENT = {
    "FEMINICIDIO": "feminicidio",
    "MORTE POR INTERVENCAO DE AGENTE DO ESTADO": "morte_interv_policial",
}


@dataclass(frozen=True)
class SpMunicipality:
    id: int
    name: str


def sp_monthly_rows(start_year: int, end_year: int, end_month: int) -> pd.DataFrame:
    processed_path = settings.data_dir / "processed" / f"ssp_sp_monthly_{start_year}_{end_year}_{end_month}.csv"
    if processed_path.exists() and processed_path.stat().st_size > 0:
        return pd.read_csv(processed_path)

    municipalities = _load_municipalities()
    rows = asyncio.run(_download_ssp_rows(municipalities, start_year, end_year))
    frame = pd.DataFrame(rows)
    sinesp = _sinesp_sp_rows(start_year, end_year)
    if not sinesp.empty:
        frame = pd.concat([frame, sinesp], ignore_index=True)

    frame = frame[(frame["year"] < end_year) | ((frame["year"] == end_year) & (frame["month"] <= end_month))]
    frame = _add_letalidade_violenta(frame)
    frame = frame.sort_values(["indicator", "territory_type", "territory_name", "year", "month"])
    processed_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(processed_path, index=False)
    return frame


def sp_municipalities() -> list[str]:
    return sorted([municipality.name for municipality in _load_municipalities()])


def sp_source_metadata() -> list[dict[str, object]]:
    raw_dir = settings.data_dir / "raw" / "ssp_sp"
    sinesp_path = settings.data_dir / "raw" / "sinesp" / "basededadosvde.zip"
    return [
        {
            "name": "ssp_sp_monthly_api",
            "category": "crime_stats",
            "url": SSP_SP_MONTHLY_ENDPOINT,
            "file_name": "ssp_sp_monthly_api_cache",
            "checksum_sha256": None,
            "size_bytes": _directory_size(raw_dir),
            "available": raw_dir.exists(),
        },
        {
            "name": "ssp_sp_municipalities_api",
            "category": "territory",
            "url": SSP_SP_MUNICIPALITIES_URL,
            "file_name": "municipios.json",
            "checksum_sha256": None,
            "size_bytes": (raw_dir / "municipios.json").stat().st_size if (raw_dir / "municipios.json").exists() else None,
            "available": (raw_dir / "municipios.json").exists(),
        },
        {
            "name": "sinesp_vde_sp_complement",
            "category": "crime_stats",
            "url": SINESP_VDE_URL,
            "file_name": "basededadosvde.zip",
            "checksum_sha256": None,
            "size_bytes": sinesp_path.stat().st_size if sinesp_path.exists() else None,
            "available": sinesp_path.exists(),
        },
    ]


async def _download_ssp_rows(municipalities: list[SpMunicipality], start_year: int, end_year: int) -> list[dict[str, object]]:
    semaphore = asyncio.Semaphore(8)
    years = list(range(start_year, end_year + 1))
    targets: list[tuple[str, str, int, int]] = [("state", "Estado de São Paulo", 0, year) for year in years]
    targets.extend(("municipality", municipality.name, municipality.id, year) for municipality in municipalities for year in years)

    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        tasks = [_fetch_target(client, semaphore, target) for target in targets]
        chunks = await asyncio.gather(*tasks)

    return [row for chunk in chunks for row in chunk]


async def _fetch_target(
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    target: tuple[str, str, int, int],
) -> list[dict[str, object]]:
    territory_type, territory_name, territory_id, year = target
    output: list[dict[str, object]] = []
    for group_id in (6, 9):
        payload = await _fetch_ssp_payload(client, semaphore, territory_type, territory_id, year, group_id)
        output.extend(_rows_from_ssp_payload(payload, territory_type, territory_name, year))
    return output


async def _fetch_ssp_payload(
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    territory_type: str,
    territory_id: int,
    year: int,
    group_id: int,
) -> dict[str, Any]:
    cache_path = _ssp_cache_path(territory_type, territory_id, year, group_id)
    if cache_path.exists() and cache_path.stat().st_size > 0:
        return json.loads(cache_path.read_text(encoding="utf-8"))

    params = {
        "ano": year,
        "grupoDelito": group_id,
        "tipoGrupo": "ESTADO" if territory_type == "state" else "MUNICÍPIO",
        "idGrupo": territory_id,
    }
    last_error: Exception | None = None
    async with semaphore:
        for attempt in range(5):
            try:
                response = await client.get(SSP_SP_MONTHLY_ENDPOINT, params=params)
                response.raise_for_status()
                payload = response.json()
                break
            except (httpx.ConnectError, httpx.ReadTimeout, httpx.RemoteProtocolError, httpx.HTTPStatusError) as exc:
                last_error = exc
                await asyncio.sleep(0.5 * (attempt + 1))
        else:
            raise RuntimeError(f"SSP-SP request failed after retries: {params}") from last_error

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return payload


def _rows_from_ssp_payload(payload: dict[str, Any], territory_type: str, territory_name: str, year: int) -> list[dict[str, object]]:
    output: list[dict[str, object]] = []
    for section in payload.get("data") or []:
        for item in section.get("listaDados") or []:
            delito = _normalize_label((item.get("delito") or {}).get("delito", ""))
            indicator = SSP_INDICATOR_BY_DELITO.get(delito)
            if not indicator:
                continue
            for column, month in MONTH_COLUMNS.items():
                output.append(
                    {
                        "source_name": "SSP-SP Números Sem Mistério",
                        "territory_type": territory_type,
                        "territory_name": territory_name,
                        "year": year,
                        "month": month,
                        "indicator": indicator,
                        "value": float(item.get(column) or 0),
                    }
                )
    return output


def _sinesp_sp_rows(start_year: int, end_year: int) -> pd.DataFrame:
    path = _ensure_sinesp_vde_file()
    frames: list[pd.DataFrame] = []
    with zipfile.ZipFile(path) as archive:
        for name in archive.namelist():
            year_match = re.search(r"(\d{4})", name)
            if not year_match:
                continue
            year = int(year_match.group(1))
            if year < start_year or year > end_year:
                continue
            with archive.open(name) as file:
                frame = _read_sinesp_csv(file)
            frame.columns = [_clean_sinesp_column(column) for column in frame.columns]
            frame = frame[frame["uf"].astype(str).str.upper().eq("SP")]
            frames.append(frame)

    if not frames:
        return pd.DataFrame()

    data = pd.concat(frames, ignore_index=True)
    data["indicator"] = data["evento"].map(lambda value: SINESP_INDICATOR_BY_EVENT.get(_normalize_label(value)))
    data = data.dropna(subset=["indicator"]).copy()
    data["date"] = pd.to_datetime(data["data_referencia"], format="%d/%m/%Y", errors="coerce")
    data = data.dropna(subset=["date"])
    data["year"] = data["date"].dt.year
    data["month"] = data["date"].dt.month
    data["value"] = pd.to_numeric(data["total_vitima"], errors="coerce").fillna(0)
    data["territory_name"] = data["municipio"].map(_title_municipality)
    municipal = data[
        ["territory_name", "year", "month", "indicator", "value"]
    ].copy()
    municipal["territory_type"] = "municipality"
    state = municipal.groupby(["year", "month", "indicator"], as_index=False)["value"].sum()
    state["territory_type"] = "state"
    state["territory_name"] = "Estado de São Paulo"
    output = pd.concat([municipal, state], ignore_index=True)
    output["source_name"] = "Sinesp VDE/MJSP"
    return output[["source_name", "territory_type", "territory_name", "year", "month", "indicator", "value"]]


def _add_letalidade_violenta(frame: pd.DataFrame) -> pd.DataFrame:
    components = {"homicidio_doloso", "lesao_corp_morte", "latrocinio", "morte_interv_policial"}
    base = frame[frame["indicator"].isin(components)]
    lethal = (
        base.groupby(["territory_type", "territory_name", "year", "month"], as_index=False)["value"]
        .sum()
        .assign(indicator="letalidade_violenta", source_name="SSP-SP + Sinesp VDE/MJSP")
    )
    return pd.concat([frame, lethal[frame.columns]], ignore_index=True)


def _load_municipalities() -> list[SpMunicipality]:
    raw_dir = settings.data_dir / "raw" / "ssp_sp"
    raw_dir.mkdir(parents=True, exist_ok=True)
    path = raw_dir / "municipios.json"
    if not path.exists() or path.stat().st_size == 0:
        response = httpx.get(SSP_SP_MUNICIPALITIES_URL, timeout=60, follow_redirects=True)
        response.raise_for_status()
        path.write_text(json.dumps(response.json(), ensure_ascii=False), encoding="utf-8")
    payload = json.loads(path.read_text(encoding="utf-8"))
    return [
        SpMunicipality(id=int(row["codMunicipio"]), name=str(row["nome"]))
        for row in payload.get("data", [])
        if row.get("codMunicipio") and row.get("nome")
    ]


def _ensure_sinesp_vde_file() -> Path:
    raw_dir = settings.data_dir / "raw" / "sinesp"
    raw_dir.mkdir(parents=True, exist_ok=True)
    path = raw_dir / "basededadosvde.zip"
    if path.exists() and path.stat().st_size > 0:
        return path
    response = httpx.get(SINESP_VDE_URL, timeout=180, follow_redirects=True)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _read_sinesp_csv(file: Any) -> pd.DataFrame:
    content = file.read()
    for encoding in ("utf-8-sig", "latin1"):
        try:
            from io import BytesIO

            return pd.read_csv(BytesIO(content), sep=";", encoding=encoding, dtype=str)
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError("unknown", b"", 0, 1, "Could not decode Sinesp CSV")


def _ssp_cache_path(territory_type: str, territory_id: int, year: int, group_id: int) -> Path:
    return settings.data_dir / "raw" / "ssp_sp" / "monthly" / f"{territory_type}_{territory_id}_{year}_{group_id}.json"


def _clean_sinesp_column(value: object) -> str:
    return str(value).replace("ï»¿", "").replace("\ufeff", "").strip().lower()


def _normalize_label(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(character for character in text if not unicodedata.combining(character))
    text = re.sub(r"\([^)]*\)", "", text)
    text = re.sub(r"[^A-Za-z0-9]+", " ", text).strip().upper()
    return re.sub(r"\s+", " ", text)


def _title_municipality(value: object) -> str:
    text = str(value).strip().lower()
    return " ".join(part.capitalize() for part in re.split(r"(\s+|-)", text))


def _directory_size(path: Path) -> int | None:
    if not path.exists():
        return None
    return sum(file.stat().st_size for file in path.rglob("*") if file.is_file())
