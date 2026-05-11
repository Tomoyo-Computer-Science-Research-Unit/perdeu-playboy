from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

TerritoryType = Literal["state", "municipality", "police_area"]
RankingMode = Literal["count", "rate", "yoy"]


class IndicatorOut(BaseModel):
    code: str
    name: str
    category: str
    description: str | None = None
    unit: str = "ocorrencias"
    source_name: str = "ISP Dados Abertos"


class LatestPeriodOut(BaseModel):
    year: int
    month: int
    period_date: date
    source_name: str


class TerritoryOut(BaseModel):
    territory_type: TerritoryType
    name: str


class SummaryCard(BaseModel):
    indicator: str
    name: str
    current_year_value: float
    previous_year_same_period: float
    historical_min_same_period: float | None = None
    historical_min_year: int | None = None
    historical_min_times_lower: float | None = None
    yoy_absolute_change: float
    yoy_percent_change: float | None
    latest_month: int
    sparkline: list[float]


class SummaryOut(BaseModel):
    year: int
    territory_type: TerritoryType
    territory_name: str
    latest_month: int
    cards: list[SummaryCard]


class TimeSeriesPoint(BaseModel):
    period_date: date
    year: int
    month: int
    indicator: str
    territory_type: TerritoryType
    territory_name: str
    value: float
    moving_average: float | None = None
    previous_year_value: float | None = None
    yoy_percent_change: float | None = None
    rate_per_100k: float | None = None


class RankingRow(BaseModel):
    rank: int
    territory_name: str
    territory_type: TerritoryType
    value: float
    rate_per_100k: float | None = None
    yoy_absolute_change: float | None = None
    yoy_percent_change: float | None = None


class GovernorPerformanceRow(BaseModel):
    rank: int | None
    governor: str
    party_or_condition: str
    term_start: date
    term_end: date | None = None
    months_count: int
    baseline_months_count: int
    average_reduction_percent: float | None = None
    annualized_current_value: float | None = None
    annualized_baseline_value: float | None = None
    best_indicator: str | None = None
    worst_indicator: str | None = None
    note: str | None = None


class GovernorPerformanceOut(BaseModel):
    methodology: str
    indicators: list[str]
    rows: list[GovernorPerformanceRow]


class MapFeature(BaseModel):
    type: str = "Feature"
    geometry: dict[str, Any]
    properties: dict[str, Any]


class MapOut(BaseModel):
    type: str = "FeatureCollection"
    features: list[MapFeature]


class MethodologyOut(BaseModel):
    title: str
    source_summary: str
    update_frequency: str
    limitations: list[str]
    definitions: dict[str, str]
    ethical_notes: list[str]


class NormalizedCrimeStat(BaseModel):
    source_name: str = "ISP Dados Abertos"
    territory_type: TerritoryType
    territory_name: str
    year: int
    month: int
    indicator: str
    value: float = Field(ge=0)
    period_date: date
    year_to_date: float | None = None
    previous_year_same_period: float | None = None
    yoy_absolute_change: float | None = None
    yoy_percent_change: float | None = None

    @field_validator("month")
    @classmethod
    def validate_month(cls, value: int) -> int:
        if not 1 <= value <= 12:
            raise ValueError("month must be between 1 and 12")
        return value


class SourceImportIn(BaseModel):
    source_name: str
    source_url: str
    file_name: str
    checksum: str
    imported_at: datetime
    status: str
    row_count: int | None = None
    error_message: str | None = None
