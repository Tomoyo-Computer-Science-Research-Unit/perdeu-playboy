from __future__ import annotations

import logging
import re
import unicodedata
from calendar import monthrange
from datetime import date
from pathlib import Path
from typing import Iterable

import pandas as pd

from app.etl.medallion import SilverBatch
from app.schemas import NormalizedCrimeStat

logger = logging.getLogger(__name__)

INDICATOR_COLUMN_MAP = {
    "hom_doloso": "homicidio_doloso",
    "homicidio_doloso": "homicidio_doloso",
    "lesao_corp_morte": "lesao_corp_morte",
    "latrocinio": "latrocinio",
    "letalidade_violenta": "letalidade_violenta",
    "morte_interv_policial": "morte_interv_policial",
    "hom_por_interv_policial": "morte_interv_policial",
    "feminicidio": "feminicidio",
    "roubo_rua": "roubo_rua",
    "roubo_veiculo": "roubo_veiculo",
    "roubo_carga": "roubo_carga",
    "estupro": "estupro",
    "apreensao_armas": "apreensao_armas",
    "arma_fogo_total": "apreensao_armas",
    "arma_fogo_apreendida": "apreensao_armas",
}

YEAR_COLUMNS = {"ano", "year"}
MONTH_COLUMNS = {"mes", "month"}
MUNICIPALITY_COLUMNS = {"municipio", "município", "nome_municipio", "aisp_municipio", "fmun", "munic"}
POLICE_AREA_COLUMNS = {"cisp", "dp", "delegacia", "circunscricao", "circunscrição"}


def normalize_column_name(value: str) -> str:
    """Normalize a source column name into snake-case ASCII."""

    value = str(value).strip().lower()
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_")


def normalize_territory_name(value: object) -> str:
    """Normalize a territory label while preserving human-readable casing."""

    text = "Estado do Rio de Janeiro" if pd.isna(value) else str(value).strip()
    text = re.sub(r"\s+", " ", text)
    return text


def read_isp_csv(path: Path) -> pd.DataFrame:
    """Read an ISP CSV using the known encoding fallbacks.

    Args:
        path: CSV file path.

    Returns:
        Loaded pandas dataframe.
    """

    try:
        return pd.read_csv(path, sep=";", encoding="utf-8")
    except UnicodeDecodeError:
        return pd.read_csv(path, sep=";", encoding="latin1")


def transform_isp_file(path: Path, territory_type: str, source_name: str = "ISP Dados Abertos") -> list[NormalizedCrimeStat]:
    """Transform a raw ISP CSV file into validated monthly records."""

    frame = read_isp_csv(path)
    return transform_isp_dataframe(frame, territory_type=territory_type, source_name=source_name)


def transform_to_silver(
    path: Path,
    territory_type: str,
    source_name: str,
) -> SilverBatch:
    """Safely transform a bronze ISP file into a silver validated batch.

    Args:
        path: Bronze CSV path.
        territory_type: Territory level represented by the source.
        source_name: Stable source identifier.

    Returns:
        Silver batch with rows on success or error details on failure.
    """

    try:
        rows = transform_isp_file(path, territory_type=territory_type, source_name=source_name)
        return SilverBatch(
            source_name=source_name,
            file_name=path.name,
            territory_type=territory_type,
            rows=rows,
            status="transformed",
        )
    except Exception as exc:
        logger.exception("Failed to transform ISP source %s", path)
        return SilverBatch(
            source_name=source_name,
            file_name=path.name,
            territory_type=territory_type,
            status="error",
            error_message=str(exc),
        )


def transform_isp_dataframe(
    frame: pd.DataFrame,
    territory_type: str,
    source_name: str = "ISP Dados Abertos",
) -> list[NormalizedCrimeStat]:
    """Normalize a raw ISP dataframe into long-form validated crime-stat rows."""

    normalized = frame.rename(columns={column: normalize_column_name(column) for column in frame.columns})
    year_col = _first_existing(normalized.columns, YEAR_COLUMNS)
    month_col = _first_existing(normalized.columns, MONTH_COLUMNS)
    if not year_col or not month_col:
        raise ValueError("ISP dataframe must include year/month columns such as ano and mes")

    territory_col = _territory_column(normalized.columns, territory_type)
    normalized["territory_name"] = (
        normalized[territory_col].map(normalize_territory_name) if territory_col else "Estado do Rio de Janeiro"
    )
    normalized["year"] = pd.to_numeric(normalized[year_col], errors="coerce").astype("Int64")
    normalized["month"] = pd.to_numeric(normalized[month_col], errors="coerce").astype("Int64")
    normalized = normalized.dropna(subset=["year", "month"])

    value_columns = [column for column in normalized.columns if column in INDICATOR_COLUMN_MAP]
    if not value_columns:
        raise ValueError("No supported ISP indicator columns found")

    melted = normalized.melt(
        id_vars=["territory_name", "year", "month"],
        value_vars=value_columns,
        var_name="raw_indicator",
        value_name="value",
    )
    melted["indicator"] = melted["raw_indicator"].map(INDICATOR_COLUMN_MAP)
    melted["value"] = pd.to_numeric(melted["value"], errors="coerce").fillna(0)
    melted["period_date"] = melted.apply(
        lambda row: date(int(row["year"]), int(row["month"]), monthrange(int(row["year"]), int(row["month"]))[1]),
        axis=1,
    )

    records = _add_yoy_fields(melted, territory_type=territory_type, source_name=source_name)
    return [NormalizedCrimeStat.model_validate(record) for record in records]


def _add_yoy_fields(frame: pd.DataFrame, territory_type: str, source_name: str) -> list[dict]:
    frame = frame.sort_values(["territory_name", "indicator", "year", "month"]).copy()
    frame["year_to_date"] = frame.groupby(["territory_name", "indicator", "year"])["value"].cumsum()

    previous = frame[
        ["territory_name", "indicator", "year", "month", "year_to_date"]
    ].rename(columns={"year_to_date": "previous_year_same_period", "year": "previous_join_year"})
    previous["year"] = previous["previous_join_year"] + 1
    merged = frame.merge(
        previous[["territory_name", "indicator", "year", "month", "previous_year_same_period"]],
        on=["territory_name", "indicator", "year", "month"],
        how="left",
    )
    merged["yoy_absolute_change"] = merged["year_to_date"] - merged["previous_year_same_period"]
    merged["yoy_percent_change"] = merged.apply(
        lambda row: (
            row["yoy_absolute_change"] / row["previous_year_same_period"] * 100
            if pd.notna(row["previous_year_same_period"]) and row["previous_year_same_period"] != 0
            else None
        ),
        axis=1,
    )

    records = []
    for row in merged.to_dict(orient="records"):
        records.append(
            {
                "source_name": source_name,
                "territory_type": territory_type,
                "territory_name": row["territory_name"],
                "year": int(row["year"]),
                "month": int(row["month"]),
                "indicator": row["indicator"],
                "value": float(row["value"]),
                "period_date": row["period_date"],
                "year_to_date": _nullable_float(row.get("year_to_date")),
                "previous_year_same_period": _nullable_float(row.get("previous_year_same_period")),
                "yoy_absolute_change": _nullable_float(row.get("yoy_absolute_change")),
                "yoy_percent_change": _nullable_float(row.get("yoy_percent_change")),
            }
        )
    return records


def _first_existing(columns: Iterable[str], candidates: set[str]) -> str | None:
    normalized_candidates = {normalize_column_name(candidate) for candidate in candidates}
    for column in columns:
        if column in normalized_candidates:
            return column
    return None


def _territory_column(columns: Iterable[str], territory_type: str) -> str | None:
    if territory_type == "municipality":
        return _first_existing(columns, MUNICIPALITY_COLUMNS)
    if territory_type == "police_area":
        return _first_existing(columns, POLICE_AREA_COLUMNS)
    return None


def _nullable_float(value: object) -> float | None:
    if pd.isna(value):
        return None
    return float(value)
