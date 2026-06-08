from fastapi import APIRouter, HTTPException, Query

from app.constants import ANALYSIS_START_YEAR
from app.schemas import (
    GovernorPerformanceOut,
    IndicatorOut,
    LatestPeriodOut,
    MapOut,
    MethodologyOut,
    RankingMode,
    RankingRow,
    SummaryOut,
    TerritoryOut,
    TerritoryType,
    TimeSeriesPoint,
)
from app.services.analytics import (
    get_map,
    get_rankings,
    get_summary,
    get_territories,
    get_timeseries,
    latest_period,
    methodology,
)
from app.services.indicator_catalog import INDICATOR_BY_CODE, INDICATORS
from app.services.governor_performance import governor_performance
from app.services.territory_repository import neighborhoods as get_neighborhoods
from app.services.territory_repository import territorial_units as get_territorial_units

router = APIRouter()


@router.get("/indicators")
def indicators() -> list[IndicatorOut]:
    return INDICATORS


@router.get("/latest-period", response_model=LatestPeriodOut)
def latest_period_endpoint() -> LatestPeriodOut:
    return latest_period()


@router.get("/territories")
def territories(territory_type: TerritoryType = "state") -> list[TerritoryOut]:
    return [
        TerritoryOut(territory_type=territory_type, name=name)
        for name in get_territories(territory_type)
    ]


@router.get("/neighborhoods")
def neighborhoods(municipality: str | None = "Rio de Janeiro") -> list[dict[str, str | int]]:
    return get_neighborhoods(municipality)


@router.get("/territorial-units")
def territorial_units(municipality: str | None = "Rio de Janeiro") -> list[dict[str, str | int]]:
    return get_territorial_units(municipality)


@router.get("/summary", response_model=SummaryOut)
def summary(
    year: int = Query(..., ge=ANALYSIS_START_YEAR, le=2100),
    territory_type: TerritoryType = "state",
    territory_name: str | None = None,
) -> SummaryOut:
    return get_summary(year, territory_type, territory_name)


@router.get("/timeseries")
def timeseries(
    indicator: str,
    territory_type: TerritoryType = "state",
    territory_name: str | None = None,
    start_year: int = Query(ANALYSIS_START_YEAR, ge=ANALYSIS_START_YEAR),
    end_year: int = Query(2026, le=2100),
) -> list[TimeSeriesPoint]:
    _validate_indicator(indicator)
    return get_timeseries(indicator, territory_type, territory_name, start_year, end_year)


@router.get("/rankings")
def rankings(
    indicator: str,
    year: int = Query(..., ge=ANALYSIS_START_YEAR, le=2100),
    month: int = Query(..., ge=1, le=12),
    territory_type: TerritoryType = "municipality",
    mode: RankingMode = "count",
) -> list[RankingRow]:
    _validate_indicator(indicator)
    if territory_type == "state":
        raise HTTPException(status_code=400, detail="Rankings require municipality or police_area territory_type")
    return get_rankings(indicator, year, month, territory_type, mode)


@router.get("/governors-performance", response_model=GovernorPerformanceOut)
def governors_performance_endpoint() -> GovernorPerformanceOut:
    return governor_performance()


@router.get("/map", response_model=MapOut)
def map_endpoint(
    indicator: str,
    year: int = Query(..., ge=ANALYSIS_START_YEAR, le=2100),
    month: int = Query(..., ge=1, le=12),
    territory_type: TerritoryType = "municipality",
) -> MapOut:
    _validate_indicator(indicator)
    if territory_type == "state":
        raise HTTPException(status_code=400, detail="Map requires municipality or police_area territory_type")
    return get_map(indicator, year, month, territory_type)


@router.get("/methodology", response_model=MethodologyOut)
def methodology_endpoint() -> MethodologyOut:
    return MethodologyOut.model_validate(methodology())


def _validate_indicator(indicator: str) -> None:
    if indicator not in INDICATOR_BY_CODE:
        raise HTTPException(status_code=404, detail=f"Unknown indicator: {indicator}")
