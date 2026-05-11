import type { GeoFeatureCollection, GovernorPerformanceResponse, Indicator, Methodology, Neighborhood, RankingMode, RankingRow, SummaryResponse, TerritorialUnit, Territory, TerritoryType, TimeSeriesPoint } from "@/types/api";
import { ANALYSIS_START_YEAR } from "@/lib/constants";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${path}`);
  }
  return (await response.json()) as T;
}

export function getIndicators(): Promise<Indicator[]> {
  return fetchJson<Indicator[]>("/api/indicators");
}

export function getSummary(
  year = 2026,
  territoryType: TerritoryType = "state",
  territoryName?: string
): Promise<SummaryResponse> {
  const params = new URLSearchParams({
    year: String(year),
    territory_type: territoryType
  });
  if (territoryName) {
    params.set("territory_name", territoryName);
  }
  return fetchJson<SummaryResponse>(`/api/summary?${params.toString()}`);
}

export function getLatestPeriod(): Promise<{ year: number; month: number; period_date: string; source_name: string }> {
  return fetchJson<{ year: number; month: number; period_date: string; source_name: string }>("/api/latest-period");
}

export function getTimeseries(
  indicator = "letalidade_violenta",
  territoryType: TerritoryType = "state",
  territoryName?: string,
  startYear = ANALYSIS_START_YEAR,
  endYear = 2026
): Promise<TimeSeriesPoint[]> {
  const params = new URLSearchParams({
    indicator,
    territory_type: territoryType,
    start_year: String(startYear),
    end_year: String(endYear)
  });
  if (territoryName && territoryType !== "state") {
    params.set("territory_name", territoryName);
  }
  if (territoryType === "state") {
    params.set("territory_name", "Estado do Rio de Janeiro");
  }
  return fetchJson<TimeSeriesPoint[]>(`/api/timeseries?${params.toString()}`);
}

export function getTerritories(territoryType: TerritoryType): Promise<Territory[]> {
  return fetchJson<Territory[]>(`/api/territories?territory_type=${territoryType}`);
}

export function getNeighborhoods(municipality = "Rio de Janeiro"): Promise<Neighborhood[]> {
  const params = new URLSearchParams({ municipality });
  return fetchJson<Neighborhood[]>(`/api/neighborhoods?${params.toString()}`);
}

export function getTerritorialUnits(municipality = "Rio de Janeiro"): Promise<TerritorialUnit[]> {
  const params = new URLSearchParams({ municipality });
  return fetchJson<TerritorialUnit[]>(`/api/territorial-units?${params.toString()}`);
}

export function getRankings(
  indicator = "letalidade_violenta",
  mode: RankingMode = "count",
  territoryType: Exclude<TerritoryType, "state"> = "municipality",
  year = 2026,
  month = 3
): Promise<RankingRow[]> {
  return fetchJson<RankingRow[]>(
    `/api/rankings?indicator=${indicator}&year=${year}&month=${month}&territory_type=${territoryType}&mode=${mode}`
  );
}

export function getGovernorPerformance(): Promise<GovernorPerformanceResponse> {
  return fetchJson<GovernorPerformanceResponse>("/api/governors-performance");
}

export function getMethodology(): Promise<Methodology> {
  return fetchJson<Methodology>("/api/methodology");
}

export function getMapData(indicator = "letalidade_violenta"): Promise<GeoFeatureCollection> {
  return fetchJson<GeoFeatureCollection>(`/api/map?indicator=${indicator}&year=2026&month=3&territory_type=municipality`);
}
