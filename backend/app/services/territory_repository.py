from __future__ import annotations

import logging
import re
from functools import lru_cache
from pathlib import Path

import httpx
import pandas as pd

from app.config import settings
from app.etl.extract import checksum_file
from app.etl.transform import normalize_column_name, read_isp_csv

logger = logging.getLogger(__name__)

ISP_TERRITORIAL_DIVISION_URL = (
    "https://www.ispdados.rj.gov.br/Arquivos/Relacao_RISPxAISPxCISP.csv"
)


def neighborhoods(municipality: str | None = "Rio de Janeiro") -> list[dict[str, str | int]]:
    frame = _neighborhood_frame()
    if municipality:
        frame = frame[frame["municipality"].str.casefold() == municipality.casefold()]
    records = frame.sort_values(["neighborhood", "cisp"]).to_dict(orient="records")
    return [
        {
            "name": row["display_name"],
            "neighborhood": row["neighborhood"],
            "municipality": row["municipality"],
            "cisp": int(row["cisp"]),
            "police_area_name": f"CISP {int(row['cisp']):03d}",
            "source_name": "ISP Dados Abertos - Divisao Territorial de Seguranca Publica",
        }
        for row in records
    ]


def territorial_units(municipality: str | None = "Rio de Janeiro") -> list[dict[str, str | int]]:
    frame = _territorial_division_frame()
    if municipality:
        frame = frame[frame["municipality"].str.casefold() == municipality.casefold()]
    records = frame.sort_values(["cisp", "territorial_unit"]).to_dict(orient="records")
    return [
        {
            "name": f"CISP {int(row['cisp']):03d} - {row['territorial_unit']}",
            "territorial_unit": row["territorial_unit"],
            "municipality": row["municipality"],
            "cisp": int(row["cisp"]),
            "police_area_name": f"CISP {int(row['cisp']):03d}",
            "source_name": "ISP Dados Abertos - Divisao Territorial de Seguranca Publica",
        }
        for row in records
    ]


@lru_cache(maxsize=1)
def _territorial_division_frame() -> pd.DataFrame:
    path = _ensure_territorial_division_file()
    raw = read_isp_csv(path)
    raw = raw.rename(columns={column: normalize_column_name(column) for column in raw.columns})

    required = {"cisp", "unidade_territorial", "municipio"}
    missing = required - set(raw.columns)
    if missing:
        raise ValueError(f"Territorial division CSV missing columns: {sorted(missing)}")

    frame = raw[["cisp", "unidade_territorial", "municipio"]].copy()
    frame["cisp"] = pd.to_numeric(frame["cisp"], errors="coerce")
    frame = frame.dropna(subset=["cisp", "unidade_territorial", "municipio"])
    frame["cisp"] = frame["cisp"].astype(int)
    frame["territorial_unit"] = frame["unidade_territorial"].astype(str).str.strip()
    frame["municipality"] = frame["municipio"].astype(str).str.strip()
    frame = frame[frame["territorial_unit"] != ""]
    return frame[["cisp", "territorial_unit", "municipality"]].drop_duplicates()


@lru_cache(maxsize=1)
def _neighborhood_frame() -> pd.DataFrame:
    rows: list[dict[str, str | int]] = []
    for row in _territorial_division_frame().to_dict(orient="records"):
        for neighborhood in _split_neighborhoods(row.get("territorial_unit")):
            rows.append(
                {
                    "neighborhood": neighborhood,
                    "municipality": row["municipality"],
                    "cisp": int(row["cisp"]),
                }
            )

    frame = pd.DataFrame(rows).drop_duplicates()
    if frame.empty:
        return frame

    duplicated = frame.duplicated(subset=["neighborhood", "municipality"], keep=False)
    frame["display_name"] = frame["neighborhood"]
    frame.loc[duplicated, "display_name"] = frame.loc[duplicated].apply(
        lambda row: f"{row['neighborhood']} - CISP {int(row['cisp']):03d}",
        axis=1,
    )
    return frame


def _split_neighborhoods(value: object) -> list[str]:
    if value is None or pd.isna(value):
        return []
    text = str(value).strip()
    if not text:
        return []
    text = re.sub(r"\s+e\s+", ", ", text)
    return [part.strip() for part in text.split(",") if part.strip()]


def _ensure_territorial_division_file() -> Path:
    raw_dir = (settings.data_dir / "raw" / "isp").resolve()
    raw_dir.mkdir(parents=True, exist_ok=True)
    path = raw_dir / "Relacao_RISPxAISPxCISP.csv"
    if path.exists() and path.stat().st_size > 0:
        return path

    logger.info("Downloading ISP territorial division CSV %s", ISP_TERRITORIAL_DIVISION_URL)
    with httpx.stream("GET", ISP_TERRITORIAL_DIVISION_URL, timeout=60, follow_redirects=True) as response:
        response.raise_for_status()
        with path.open("wb") as file:
            for chunk in response.iter_bytes():
                file.write(chunk)
    logger.info("Downloaded %s checksum=%s", path.name, checksum_file(path))
    return path
