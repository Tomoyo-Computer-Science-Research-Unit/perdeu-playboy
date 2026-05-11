export type TerritoryType = "state" | "municipality" | "police_area";
export type RankingMode = "count" | "rate" | "yoy";

export interface Indicator {
  code: string;
  name: string;
  category: string;
  description?: string;
  unit: string;
  source_name: string;
}

export interface SummaryCardData {
  indicator: string;
  name: string;
  current_year_value: number;
  previous_year_same_period: number;
  historical_min_same_period: number | null;
  historical_min_year: number | null;
  historical_min_times_lower: number | null;
  yoy_absolute_change: number;
  yoy_percent_change: number | null;
  latest_month: number;
  sparkline: number[];
}

export interface SummaryResponse {
  year: number;
  territory_type: TerritoryType;
  territory_name: string;
  latest_month: number;
  cards: SummaryCardData[];
}

export interface TimeSeriesPoint {
  period_date: string;
  year: number;
  month: number;
  indicator: string;
  territory_type: TerritoryType;
  territory_name: string;
  value: number;
  moving_average: number | null;
  previous_year_value: number | null;
  yoy_percent_change: number | null;
  rate_per_100k: number | null;
}

export interface RankingRow {
  rank: number;
  territory_name: string;
  territory_type: TerritoryType;
  value: number;
  rate_per_100k: number | null;
  yoy_absolute_change: number | null;
  yoy_percent_change: number | null;
}

export interface GovernorPerformanceRow {
  rank: number | null;
  governor: string;
  party_or_condition: string;
  term_start: string;
  term_end: string | null;
  months_count: number;
  baseline_months_count: number;
  average_reduction_percent: number | null;
  annualized_current_value: number | null;
  annualized_baseline_value: number | null;
  best_indicator: string | null;
  worst_indicator: string | null;
  note: string | null;
}

export interface GovernorPerformanceResponse {
  methodology: string;
  indicators: string[];
  rows: GovernorPerformanceRow[];
}

export interface Methodology {
  title: string;
  source_summary: string;
  update_frequency: string;
  limitations: string[];
  definitions: Record<string, string>;
  ethical_notes: string[];
}

export interface Territory {
  territory_type: TerritoryType;
  name: string;
}

export interface Neighborhood {
  name: string;
  neighborhood: string;
  municipality: string;
  cisp: number;
  police_area_name: string;
  source_name: string;
}

export interface TerritorialUnit {
  name: string;
  territorial_unit: string;
  municipality: string;
  cisp: number;
  police_area_name: string;
  source_name: string;
}

export interface GeoFeatureCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: GeoJSON.Geometry;
    properties: Record<string, unknown>;
  }>;
}
