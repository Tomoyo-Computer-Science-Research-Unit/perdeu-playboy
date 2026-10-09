import type { Geometry } from "geojson";

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

export interface LatestPeriod {
  year: number;
  month: number;
  period_date: string;
  source_name: string;
}

export interface SnapshotMeta {
  generated_at: string;
  analysis_start_year: number;
  latest_period: LatestPeriod;
  coverage: Coverage;
}

export interface Coverage {
  state_start_year: number;
  municipality_start_year: number | null;
  police_area_start_year: number | null;
  latest_by_type: Partial<Record<TerritoryType, string>>;
  first_month_by_indicator: Record<string, Partial<Record<TerritoryType, string | null>>>;
  map_drilldown: string | null;
}

export interface Territory {
  territory_type: TerritoryType;
  name: string;
}

export interface TerritorialUnit {
  name: string;
  territorial_unit: string;
  municipality: string;
  cisp: number;
  police_area_name: string;
  source_name: string;
}

export interface PopulationYear {
  value: number;
  interpolated: boolean;
}

export interface GovernorTerm {
  governor: string;
  party_or_condition: string;
  term_start: string;
  term_end: string | null;
}

/** Year-to-date comparison for one indicator in one territory. */
export interface SummaryCardData {
  indicator: string;
  name: string;
  category: string;
  unit: string;
  year: number;
  latest_month: number;
  /** Sum from January to `latest_month` of `year`. */
  current_year_value: number;
  /** Same months of the previous year, or null when the series did not exist yet. */
  previous_year_same_period: number | null;
  yoy_absolute_change: number | null;
  yoy_percent_change: number | null;
  /** Lowest and highest value for the same months across every year with data. */
  historical_min: { year: number; value: number } | null;
  historical_max: { year: number; value: number } | null;
  /** Rate per 100k inhabitants for the current year-to-date, when population is known. */
  rate_per_100k: number | null;
  first_year: number;
  /** Annual totals for complete years, oldest first (sparkline). */
  annual_history: Array<{ year: number; value: number }>;
}

export interface SummaryResponse {
  year: number;
  latest_month: number;
  territory_type: TerritoryType;
  territory_name: string;
  cards: SummaryCardData[];
}

export interface AnnualPoint {
  year: number;
  /** Sum of the months with data; null when the year has no data at all. */
  value: number | null;
  months_with_data: number;
  complete: boolean;
  /** Same months of the previous year (useful for the partial current year). */
  previous_same_period: number | null;
  yoy_percent_change: number | null;
  population: number | null;
  population_interpolated: boolean;
  /** Occurrences per 100k inhabitants; only for complete years with known population. */
  rate_per_100k: number | null;
}

export interface MonthlyPoint {
  period_date: string;
  year: number;
  month: number;
  value: number | null;
  /** Sum of the last 12 months, null while fewer than 12 months are available. */
  rolling_12: number | null;
  previous_year_value: number | null;
  yoy_percent_change: number | null;
}

export interface RankingRow {
  rank: number;
  territory_name: string;
  territory_type: TerritoryType;
  value: number;
  rate_per_100k: number | null;
  yoy_absolute_change: number | null;
  yoy_percent_change: number | null;
  trend_status?: "worse" | "better" | "stable" | "inconclusive";
  trend_label?: string;
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

export interface DataSource {
  name: string;
  category: string;
  url: string;
  file_name: string;
  checksum_sha256: string | null;
  size_bytes: number | null;
  available: boolean;
}

export interface GeoFeatureCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: Geometry;
    properties: Record<string, unknown>;
  }>;
}

export interface ChangeRow {
  rank: number;
  territory_name: string;
  territory_type: TerritoryType;
  current_value: number;
  previous_value: number;
  absolute_change: number;
  percent_change: number | null;
}

export interface ChangeSection {
  title: string;
  territory_type: TerritoryType;
  direction: "increase" | "decrease";
  rows: ChangeRow[];
}

export interface LatestChangesResponse {
  latest_period: LatestPeriod;
  sections: ChangeSection[];
}
