from __future__ import annotations

import logging
from calendar import monthrange
from functools import lru_cache
from pathlib import Path
from typing import cast

import httpx
import pandas as pd

from app.config import settings
from app.constants import CISP_TO_UNIDADE_TERRITORIAL
from app.etl.extract import checksum_file
from app.etl.sources import IspSource, default_isp_sources
from app.etl.transform import INDICATOR_COLUMN_MAP, normalize_column_name, read_isp_csv
from app.services.territory_repository import territorial_units

logger = logging.getLogger(__name__)

OFFICIAL_SOURCE_NAME = "ISP Dados Abertos"

_SOURCES = default_isp_sources()
SOURCE_BY_TERRITORY = {
    "state": next(source for source in _SOURCES if source.name == "isp_monthly_state"),
    "municipality": next(source for source in _SOURCES if source.name == "isp_monthly_municipality"),
    "police_area": next(source for source in _SOURCES if source.name == "isp_monthly_police_area"),
}
WEAPONS_SOURCE = next(source for source in _SOURCES if source.name == "isp_weapons_police_area")
STATS_COLUMNS = [
    "source_name",
    "territory_type",
    "territory_name",
    "police_area_name",
    "ibge_code",
    "year",
    "month",
    "period_date",
    "indicator",
    "value",
]


def latest_period() -> tuple[int, int]:
    frame = _stats_frame("state")
    latest = frame.sort_values(["year", "month"]).iloc[-1]
    return int(latest["year"]), int(latest["month"])


def indicators_available(territory_type: str) -> set[str]:
    return set(_stats_frame(territory_type)["indicator"].unique())


def territories(territory_type: str) -> list[str]:
    frame = _stats_frame(territory_type)
    names = frame["territory_name"].dropna().drop_duplicates().sort_values()
    return [str(name) for name in names.tolist()]


def rows(
    indicator: str,
    territory_type: str,
    territory_name: str | None = None,
    start_year: int | None = None,
    end_year: int | None = None,
) -> pd.DataFrame:
    frame = _stats_frame(territory_type)
    filtered = frame[frame["indicator"] == indicator]
    if territory_name:
        filtered = _filter_territory(filtered, territory_name)
    if start_year is not None:
        filtered = filtered[filtered["year"] >= start_year]
    if end_year is not None:
        filtered = filtered[filtered["year"] <= end_year]
    return filtered.sort_values(["territory_name", "year", "month"]).copy()


def ytd_rows(indicator: str, territory_type: str, year: int, month: int) -> pd.DataFrame:
    frame = _stats_frame(territory_type)
    return frame[
        (frame["indicator"] == indicator)
        & (frame["year"] == year)
        & (frame["month"] <= month)
    ].copy()


@lru_cache(maxsize=4)
def _stats_frame(territory_type: str) -> pd.DataFrame:
    if territory_type not in SOURCE_BY_TERRITORY:
        raise ValueError(f"Unsupported territory_type: {territory_type}")

    source = SOURCE_BY_TERRITORY[territory_type]
    frame = _read_normalized_source(source)
    if territory_type == "state":
        frame = pd.concat([frame, _state_weapons_frame()], ignore_index=True)
    if territory_type == "municipality":
        frame = pd.concat([frame, _municipality_weapons_frame()], ignore_index=True)
    if territory_type == "police_area":
        frame = pd.concat([frame, _police_area_weapons_frame()], ignore_index=True)
    return frame


def _read_normalized_source(source: IspSource) -> pd.DataFrame:
    path = _ensure_source_file(source)
    raw = read_isp_csv(path)
    raw = raw.rename(columns={column: normalize_column_name(column) for column in raw.columns})

    value_columns = [column for column in raw.columns if column in INDICATOR_COLUMN_MAP]
    raw["year"] = pd.to_numeric(raw["ano"], errors="coerce").astype("Int64")
    raw["month"] = pd.to_numeric(raw["mes"], errors="coerce").astype("Int64")
    raw = raw.dropna(subset=["year", "month"])
    raw["territory_name"] = _territory_name(raw, source.territory_type)
    raw["police_area_name"] = _police_area_name(raw, source.territory_type)
    raw["ibge_code"] = _ibge_code(raw, source.territory_type)

    melted = raw.melt(
        id_vars=["territory_name", "police_area_name", "ibge_code", "year", "month"],
        value_vars=value_columns,
        var_name="raw_indicator",
        value_name="value",
    )
    melted["indicator"] = melted["raw_indicator"].map(INDICATOR_COLUMN_MAP)
    melted["value"] = pd.to_numeric(melted["value"], errors="coerce").fillna(0.0)
    melted["period_date"] = melted.apply(
        lambda row: pd.Timestamp(
            int(row["year"]),
            int(row["month"]),
            monthrange(int(row["year"]), int(row["month"]))[1],
        ).date(),
        axis=1,
    )
    melted["territory_type"] = source.territory_type
    melted["source_name"] = OFFICIAL_SOURCE_NAME
    result = melted[
        [
            "source_name",
            "territory_type",
            "territory_name",
            "police_area_name",
            "ibge_code",
            "year",
            "month",
            "period_date",
            "indicator",
            "value",
        ]
    ]
    logger.info(
        "Loaded %s official ISP rows for %s from %s",
        len(result),
        source.territory_type,
        source.file_name,
    )
    return result


def _state_weapons_frame() -> pd.DataFrame:
    grouped = _raw_weapons_frame().groupby(["year", "month"], as_index=False)["value"].sum()
    grouped["source_name"] = OFFICIAL_SOURCE_NAME
    grouped["territory_type"] = "state"
    grouped["territory_name"] = "Estado do Rio de Janeiro"
    grouped["police_area_name"] = None
    grouped["ibge_code"] = None
    grouped["indicator"] = "apreensao_armas"
    grouped["period_date"] = grouped.apply(
        lambda row: pd.Timestamp(
            int(row["year"]),
            int(row["month"]),
            monthrange(int(row["year"]), int(row["month"]))[1],
        ).date(),
        axis=1,
    )
    return cast(pd.DataFrame, grouped.loc[:, STATS_COLUMNS])


def _police_area_weapons_frame() -> pd.DataFrame:
    raw = _raw_weapons_frame()
    if raw.empty:
        return _empty_stats_frame()

    raw["territory_type"] = "police_area"
    raw["territory_name"] = _territory_name(raw, "police_area")
    raw["police_area_name"] = _police_area_name(raw, "police_area")
    raw["ibge_code"] = None
    raw["source_name"] = OFFICIAL_SOURCE_NAME
    raw["indicator"] = "apreensao_armas"
    raw["period_date"] = raw.apply(
        lambda row: pd.Timestamp(
            int(row["year"]),
            int(row["month"]),
            monthrange(int(row["year"]), int(row["month"]))[1],
        ).date(),
        axis=1,
    )
    return cast(pd.DataFrame, raw.loc[:, STATS_COLUMNS])


def _municipality_weapons_frame() -> pd.DataFrame:
    raw = _raw_weapons_frame()
    if raw.empty:
        return _empty_stats_frame()

    cisp_to_municipalities: dict[int, list[str]] = {}
    for unit_row in territorial_units(None):
        cisp = int(unit_row["cisp"])
        municipality = str(unit_row["municipality"])
        cisp_to_municipalities.setdefault(cisp, [])
        if municipality not in cisp_to_municipalities[cisp]:
            cisp_to_municipalities[cisp].append(municipality)

    rows: list[dict[str, object]] = []
    for weapon_row in raw.to_dict(orient="records"):
        municipalities = cisp_to_municipalities.get(int(weapon_row["cisp"]), [])
        if not municipalities:
            continue
        shared_value = float(weapon_row["value"]) / len(municipalities)
        for municipality in municipalities:
            rows.append(
                {
                    "year": int(weapon_row["year"]),
                    "month": int(weapon_row["month"]),
                    "territory_name": municipality,
                    "value": shared_value,
                }
            )

    if not rows:
        return _empty_stats_frame()

    frame = pd.DataFrame(rows)
    grouped = frame.groupby(["territory_name", "year", "month"], as_index=False)["value"].sum()
    grouped["source_name"] = OFFICIAL_SOURCE_NAME
    grouped["territory_type"] = "municipality"
    grouped["police_area_name"] = None
    grouped["ibge_code"] = grouped["territory_name"].map(_municipality_name_to_ibge_code())
    grouped["indicator"] = "apreensao_armas"
    grouped["period_date"] = grouped.apply(
        lambda row: pd.Timestamp(
            int(row["year"]),
            int(row["month"]),
            monthrange(int(row["year"]), int(row["month"]))[1],
        ).date(),
        axis=1,
    )
    return cast(pd.DataFrame, grouped.loc[:, STATS_COLUMNS])


def _raw_weapons_frame() -> pd.DataFrame:
    path = _ensure_source_file(WEAPONS_SOURCE)
    raw = read_isp_csv(path)
    raw = raw.rename(columns={column: normalize_column_name(column) for column in raw.columns})
    raw["cisp"] = pd.to_numeric(raw["cisp"], errors="coerce").astype("Int64")
    raw["year"] = pd.to_numeric(raw["ano"], errors="coerce").astype("Int64")
    raw["month"] = pd.to_numeric(raw["mes"], errors="coerce").astype("Int64")
    raw["value"] = pd.to_numeric(raw["arma_fogo_total"], errors="coerce").fillna(0.0)
    raw = raw.dropna(subset=["cisp", "year", "month"])
    raw["cisp"] = raw["cisp"].astype(int)
    return raw[["cisp", "year", "month", "value"]].copy()


def _empty_stats_frame() -> pd.DataFrame:
    return pd.DataFrame(
        columns=[
            "source_name",
            "territory_type",
            "territory_name",
            "police_area_name",
            "ibge_code",
            "year",
            "month",
            "period_date",
            "indicator",
            "value",
        ]
    )


def _municipality_name_to_ibge_code() -> dict[str, str]:
    frame = _read_normalized_source(SOURCE_BY_TERRITORY["municipality"])
    pairs = frame[["territory_name", "ibge_code"]].drop_duplicates()
    return {
        str(row["territory_name"]): str(row["ibge_code"])
        for row in pairs.to_dict(orient="records")
        if str(row.get("ibge_code") or "").strip()
    }


def _territory_name(frame: pd.DataFrame, territory_type: str) -> pd.Series:
    if territory_type == "state":
        return pd.Series(["Estado do Rio de Janeiro"] * len(frame), index=frame.index)
    if territory_type == "municipality":
        return frame["fmun"].astype(str)
    if territory_type == "police_area":
        cisps_int = pd.to_numeric(frame["cisp"], errors="coerce").fillna(0).astype(int)
        # Retorna apenas o nome da Unidade Territorial como "Botafogo, Humaitá e Urca"
        # Se for uma CISP que não está no dicionário (fallback), retorna "CISP XXX"
        fallback_names = "CISP " + cisps_int.astype(str).str.zfill(3)
        return cisps_int.map(CISP_TO_UNIDADE_TERRITORIAL).combine_first(fallback_names)
    raise ValueError(f"Unsupported territory_type: {territory_type}")


def _police_area_name(frame: pd.DataFrame, territory_type: str) -> pd.Series:
    if territory_type == "police_area":
        cisp = pd.to_numeric(frame["cisp"], errors="coerce").fillna(0).astype(int).astype(str).str.zfill(3)
        return "CISP " + cisp
    return pd.Series([None] * len(frame), index=frame.index)


def _ibge_code(frame: pd.DataFrame, territory_type: str) -> pd.Series:
    if territory_type == "municipality" and "fmun_cod" in frame.columns:
        return (
            pd.to_numeric(frame["fmun_cod"], errors="coerce")
            .astype("Int64")
            .astype(str)
            .replace("<NA>", "")
        )
    return pd.Series([None] * len(frame), index=frame.index)


def _filter_territory(frame: pd.DataFrame, territory_name: str) -> pd.DataFrame:
    normalized = territory_name.casefold()
    mask = frame["territory_name"].str.casefold() == normalized
    if "police_area_name" in frame.columns:
        police_area_mask = frame["police_area_name"].fillna("").astype(str).str.casefold() == normalized
        mask = mask | police_area_mask
    return frame[mask]


def _ensure_source_file(source: IspSource) -> Path:
    raw_dir = (settings.data_dir / "raw" / "isp").resolve()
    raw_dir.mkdir(parents=True, exist_ok=True)
    path = raw_dir / source.file_name
    if path.exists() and path.stat().st_size > 0:
        return path

    logger.info("Downloading official ISP CSV %s", source.url)
    _download_source_file(source, path)
    logger.info("Downloaded %s checksum=%s", path.name, checksum_file(path))
    return path


def _download_source_file(source: IspSource, path: Path, attempts: int = 3) -> None:
    """Download an official ISP CSV with retries and atomic file replacement."""

    timeout = httpx.Timeout(180.0, connect=30.0)
    temporary_path = path.with_name(f"{path.name}.tmp")
    last_error: Exception | None = None

    for attempt in range(1, attempts + 1):
        try:
            with httpx.stream(
                "GET",
                source.url,
                timeout=timeout,
                follow_redirects=True,
            ) as response:
                response.raise_for_status()
                with temporary_path.open("wb") as file:
                    for chunk in response.iter_bytes():
                        file.write(chunk)
            temporary_path.replace(path)
            return
        except (httpx.HTTPError, OSError) as exc:
            last_error = exc
            temporary_path.unlink(missing_ok=True)
            logger.warning(
                "Failed to download %s on attempt %s/%s: %s",
                source.url,
                attempt,
                attempts,
                exc,
            )

    if last_error is not None:
        raise last_error
    raise RuntimeError(f"Failed to download {source.url}")
