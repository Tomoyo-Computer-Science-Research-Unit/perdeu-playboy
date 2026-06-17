from __future__ import annotations

import logging
import re
import unicodedata
import zipfile
from io import BytesIO
from pathlib import Path
from typing import cast

import httpx
import pandas as pd
from pydantic import BaseModel, ConfigDict

from app.config import settings

logger = logging.getLogger(__name__)

SINESP_VDE_URL = (
    "https://dados.mj.gov.br/dataset/210b9ae2-21fc-4986-89c6-2006eb4db247/"
    "resource/e9d6cc2b-33f1-468d-ab09-9aa8303c2eba/download/basededadosvde.zip"
)

EVENT_TO_INDICATOR = {
    "HOMICIDIO DOLOSO": "homicidio_doloso",
    "LESAO CORPORAL SEGUIDA DE MORTE": "lesao_corp_morte",
    "ROUBO SEGUIDO DE MORTE": "latrocinio",
    "FEMINICIDIO": "feminicidio",
    "MORTE POR INTERVENCAO DE AGENTE DO ESTADO": "morte_interv_policial",
    "ESTUPRO": "estupro",
    "ESTUPRO DE VULNERAVEL": "estupro",
    "ROUBO DE VEICULO": "roubo_veiculo",
    "ROUBO DE CARGA": "roubo_carga",
    "ARMA DE FOGO APREENDIDA": "apreensao_armas",
}

VICTIM_INDICATORS = {
    "homicidio_doloso",
    "lesao_corp_morte",
    "latrocinio",
    "feminicidio",
    "morte_interv_policial",
    "estupro",
}


class SinespStateConfig(BaseModel):
    """Configuration for a Sinesp-backed state integration."""

    model_config = ConfigDict(frozen=True)

    uf: str
    state_name: str
    start_year: int = 2015


def sinesp_state_monthly_rows(
    config: SinespStateConfig,
    municipality_name_by_normalized: dict[str, str],
    end_year: int,
    end_month: int,
) -> pd.DataFrame:
    """Return normalized monthly rows for one UF using Sinesp VDE."""

    processed_path = (
        settings.data_dir
        / "processed"
        / f"sinesp_{config.uf.lower()}_monthly_{config.start_year}_{end_year}_{end_month}.csv"
    )
    if processed_path.exists() and processed_path.stat().st_size > 0:
        return cast(pd.DataFrame, pd.read_csv(processed_path))

    rows = _read_vde_rows(config, municipality_name_by_normalized, end_year, end_month)
    frame = pd.DataFrame(rows)
    if frame.empty:
        return frame

    frame = _add_letalidade_violenta(frame)
    frame = cast(pd.DataFrame, frame.sort_values(["indicator", "territory_type", "territory_name", "year", "month"]))
    processed_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(processed_path, index=False)
    return frame


def sinesp_source_metadata(uf: str) -> list[dict[str, object]]:
    """Return source metadata for a Sinesp-backed state."""

    path = settings.data_dir / "raw" / "sinesp" / "basededadosvde.zip"
    return [
        {
            "name": f"sinesp_vde_{uf.lower()}",
            "category": "crime_stats",
            "url": SINESP_VDE_URL,
            "file_name": path.name,
            "checksum_sha256": None,
            "size_bytes": path.stat().st_size if path.exists() else None,
            "available": path.exists(),
        }
    ]


def _read_vde_rows(
    config: SinespStateConfig,
    municipality_name_by_normalized: dict[str, str],
    end_year: int,
    end_month: int,
) -> list[dict[str, object]]:
    """Read annual VDE files from the ZIP and return normalized row dicts."""

    path = _ensure_sinesp_vde_file()
    output: list[dict[str, object]] = []
    with zipfile.ZipFile(path) as archive:
        for name in archive.namelist():
            year_match = re.search(r"(\d{4})", name)
            if not year_match:
                continue
            year = int(year_match.group(1))
            if year < config.start_year or year > end_year:
                continue
            with archive.open(name) as file:
                frame = _read_sinesp_csv(file.read())
            output.extend(_rows_from_frame(frame, config, municipality_name_by_normalized, end_year, end_month))
    return output


def _rows_from_frame(
    frame: pd.DataFrame,
    config: SinespStateConfig,
    municipality_name_by_normalized: dict[str, str],
    end_year: int,
    end_month: int,
) -> list[dict[str, object]]:
    """Convert one raw Sinesp VDE DataFrame into the app's long monthly shape."""

    frame.columns = [_clean_column(column) for column in frame.columns]
    frame = frame[frame["uf"].astype(str).str.upper().eq(config.uf)].copy()
    if frame.empty:
        return []

    frame["indicator"] = frame["evento"].map(lambda value: EVENT_TO_INDICATOR.get(_normalize_label(value)))
    frame = frame.dropna(subset=["indicator"]).copy()
    frame["date"] = pd.to_datetime(frame["data_referencia"], format="%d/%m/%Y", errors="coerce")
    frame = frame.dropna(subset=["date"])
    frame["year"] = frame["date"].dt.year
    frame["month"] = frame["date"].dt.month
    frame = frame[(frame["year"] < end_year) | ((frame["year"] == end_year) & (frame["month"] <= end_month))]
    frame = frame[frame["abrangencia"].astype(str).str.casefold().eq("estadual")]
    frame["value"] = frame.apply(_value_from_row, axis=1)

    rows: list[dict[str, object]] = []
    for row in frame.to_dict(orient="records"):
        indicator = str(row["indicator"])
        base = {
            "source_name": "Sinesp VDE/MJSP",
            "year": int(row["year"]),
            "month": int(row["month"]),
            "indicator": indicator,
            "value": float(row["value"]),
        }
        municipality = str(row.get("municipio") or "")
        canonical = municipality_name_by_normalized.get(_normalize_name(municipality))
        if canonical:
            rows.append({**base, "territory_type": "municipality", "territory_name": canonical})
        else:
            rows.append({**base, "territory_type": "state", "territory_name": config.state_name})

    frame_out = pd.DataFrame(rows)
    if frame_out.empty:
        return []

    state_rows = (
        frame_out[frame_out["territory_type"] == "municipality"]
        .groupby(["year", "month", "indicator"], as_index=False)["value"]
        .sum()
    )
    if not state_rows.empty:
        state_rows["source_name"] = "Sinesp VDE/MJSP"
        state_rows["territory_type"] = "state"
        state_rows["territory_name"] = config.state_name
        rows.extend(state_rows.to_dict(orient="records"))
    return rows


def _add_letalidade_violenta(frame: pd.DataFrame) -> pd.DataFrame:
    """Add violent lethality as the sum of its official component indicators."""

    components = {"homicidio_doloso", "lesao_corp_morte", "latrocinio", "morte_interv_policial"}
    base = frame[frame["indicator"].isin(components)]
    lethal = (
        base.groupby(["territory_type", "territory_name", "year", "month"], as_index=False)["value"]
        .sum()
        .assign(indicator="letalidade_violenta", source_name="Sinesp VDE/MJSP")
    )
    return pd.concat([frame, lethal[frame.columns]], ignore_index=True)


def _ensure_sinesp_vde_file() -> Path:
    """Return a local Sinesp VDE ZIP path, downloading it when missing."""

    raw_dir = settings.data_dir / "raw" / "sinesp"
    raw_dir.mkdir(parents=True, exist_ok=True)
    path = raw_dir / "basededadosvde.zip"
    if path.exists() and path.stat().st_size > 0:
        return path

    response = _get_with_retries(SINESP_VDE_URL, timeout=300)
    response.raise_for_status()
    path.write_bytes(response.content)
    return path


def _get_with_retries(url: str, timeout: float, attempts: int = 3) -> httpx.Response:
    """Request a URL with bounded retries for transient HTTP failures."""

    request_timeout = httpx.Timeout(timeout, connect=30)
    last_error: httpx.HTTPError | None = None
    for attempt in range(attempts):
        try:
            response = httpx.get(url, timeout=request_timeout, follow_redirects=True)
            response.raise_for_status()
            return response
        except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout, httpx.HTTPStatusError) as exc:
            last_error = exc
            logger.warning("HTTP request failed for %s on attempt %s/%s: %s", url, attempt + 1, attempts, exc)
    if last_error is not None:
        raise last_error
    raise httpx.ConnectError(f"Could not request {url}")


def _read_sinesp_csv(content: bytes) -> pd.DataFrame:
    """Read a semicolon-separated Sinesp CSV using known official encodings."""

    for encoding in ("utf-8-sig", "latin1"):
        try:
            return pd.read_csv(BytesIO(content), sep=";", encoding=encoding, dtype=str)
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError("unknown", b"", 0, 1, "Could not decode Sinesp CSV")


def _value_from_row(row: pd.Series) -> float:
    """Extract the numeric metric from a raw VDE row based on indicator type."""

    value_column = "total_vitima" if row["indicator"] in VICTIM_INDICATORS else "total"
    raw_value = row.get(value_column)
    if raw_value is None:
        return 0.0
    value = pd.to_numeric(str(raw_value), errors="coerce")
    return 0.0 if pd.isna(value) else float(value)


def _clean_column(value: object) -> str:
    """Normalize raw CSV column labels."""

    return str(value).replace("ï»¿", "").replace("\ufeff", "").strip().lower()


def _normalize_label(value: object) -> str:
    """Normalize an event label for stable dictionary matching."""

    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(character for character in text if not unicodedata.combining(character))
    text = re.sub(r"\([^)]*\)", "", text)
    text = re.sub(r"[^A-Za-z0-9]+", " ", text).strip().upper()
    return re.sub(r"\s+", " ", text)


def _normalize_name(value: object) -> str:
    """Normalize a municipality name for accent-insensitive matching."""

    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(character for character in text if not unicodedata.combining(character))
    text = re.sub(r"[^A-Za-z0-9]+", " ", text).casefold()
    return re.sub(r"\s+", " ", text).strip()
