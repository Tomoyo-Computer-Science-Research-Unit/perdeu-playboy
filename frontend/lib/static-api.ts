import snapshot from "@/lib/static-data.generated.json";
import type {
  GovernorPerformanceResponse,
  Indicator,
  DataSource,
  LatestChangesResponse,
  Methodology,
  RankingMode,
  RankingRow,
  SnapshotMeta,
  GeoFeatureCollection,
  SummaryCardData,
  SummaryResponse,
  TerritorialUnit,
  Territory,
  TerritoryType,
  TimeSeriesPoint
} from "@/types/api";

type SeriesStore = Record<string, Record<TerritoryType, Record<string, number[]>>>;
type StaticSnapshot = {
  generated_at: string;
  analysis_start_year: number;
  latest_period: { year: number; month: number; period_date: string; source_name: string };
  month_keys: string[];
  indicators: Indicator[];
  territories: Record<TerritoryType, Territory[]>;
  territorial_units: TerritorialUnit[];
  population_by_municipality: Record<string, number>;
  municipality_geometries: GeoFeatureCollection;
  rio_neighborhood_geometries: GeoFeatureCollection;
  sources: DataSource[];
  methodology: Methodology;
  governor_performance: GovernorPerformanceResponse;
  series: SeriesStore;
};

const DATA = snapshot as StaticSnapshot;
const CRIME_RATE_INDICATORS = ["letalidade_violenta", "roubo_rua", "roubo_veiculo", "roubo_carga", "estupro"];
const rankingCache = new Map<string, RankingRow[]>();
const mapCache = new Map<string, GeoFeatureCollection>();

export async function getIndicators(): Promise<Indicator[]> {
  return DATA.indicators;
}

export async function getLatestPeriod(): Promise<StaticSnapshot["latest_period"]> {
  return DATA.latest_period;
}

export async function getSnapshotMeta(): Promise<SnapshotMeta> {
  return {
    generated_at: DATA.generated_at,
    analysis_start_year: DATA.analysis_start_year,
    latest_period: DATA.latest_period
  };
}

export async function getDataSources(): Promise<DataSource[]> {
  return DATA.sources ?? [];
}

export async function getTerritories(territoryType: TerritoryType): Promise<Territory[]> {
  return DATA.territories[territoryType] ?? [];
}

export async function getTerritorialUnits(municipality = "Rio de Janeiro"): Promise<TerritorialUnit[]> {
  return DATA.territorial_units.filter((unit) => unit.municipality === municipality);
}

export async function getSummary(
  year = DATA.latest_period.year,
  territoryType: TerritoryType = "state",
  territoryName?: string
): Promise<SummaryResponse> {
  const latest = DATA.latest_period;
  const latestMonth = year === latest.year ? latest.month : 12;
  const resolvedName = resolveTerritoryName(territoryType, territoryName);
  const cards = DATA.indicators.map((indicator): SummaryCardData => {
    const values = valuesFor(indicator.code, territoryType, resolvedName);
    const current = ytd(values, year, latestMonth);
    const previous = ytd(values, year - 1, latestMonth);
    const historicalMin = historicalMinYtd(values, latestMonth);
    const diff = round1(current - previous);
    const pct = previous ? round1((diff / previous) * 100) : null;
    const minValue = historicalMin?.value ?? null;
    return {
      indicator: indicator.code,
      name: indicator.name,
      current_year_value: current,
      previous_year_same_period: previous,
      historical_min_same_period: minValue,
      historical_min_year: historicalMin?.year ?? null,
      historical_min_times_lower: minValue && minValue > 0 && current > 0 ? round1(current / minValue) : null,
      yoy_absolute_change: diff,
      yoy_percent_change: pct,
      latest_month: latestMonth,
      sparkline: yearValues(values, year)
    };
  });

  return {
    year,
    territory_type: territoryType,
    territory_name: resolvedName,
    latest_month: latestMonth,
    cards
  };
}

export async function getTimeseries(
  indicator = "letalidade_violenta",
  territoryType: TerritoryType = "state",
  territoryName?: string,
  startYear = DATA.analysis_start_year,
  endYear = DATA.latest_period.year
): Promise<TimeSeriesPoint[]> {
  const resolvedName = resolveTerritoryName(territoryType, territoryName);
  const values = valuesFor(indicator, territoryType, resolvedName);
  const points: TimeSeriesPoint[] = [];

  for (let index = 0; index < DATA.month_keys.length; index += 1) {
    const { year, month } = splitMonthKey(DATA.month_keys[index]);
    if (year < startYear || year > endYear) {
      continue;
    }
    const value = values[index] ?? 0;
    const previousYearIndex = index - 12;
    const previousValue = previousYearIndex >= 0 ? values[previousYearIndex] ?? 0 : null;
    points.push({
      period_date: periodDate(year, month),
      year,
      month,
      indicator,
      territory_type: territoryType,
      territory_name: resolvedName,
      value,
      moving_average: movingAverage(values, index),
      previous_year_value: previousValue,
      yoy_percent_change: previousValue ? round1(((value - previousValue) / previousValue) * 100) : null,
      rate_per_100k: null
    });
  }

  return points;
}

export async function getRankings(
  indicator = "letalidade_violenta",
  mode: RankingMode = "count",
  territoryType: Exclude<TerritoryType, "state"> = "municipality",
  year = DATA.latest_period.year,
  month = DATA.latest_period.month
): Promise<RankingRow[]> {
  const cacheKey = `${indicator}:${mode}:${territoryType}:${year}:${month}`;
  const cached = rankingCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const names = Object.keys(DATA.series[indicator]?.[territoryType] ?? {});
  const rows = names.map((name): RankingRow => {
    const values = valuesFor(indicator, territoryType, name);
    const value = ytd(values, year, month);
    const previous = ytd(values, year - 1, month);
    const diff = round1(value - previous);
    return {
      rank: 0,
      territory_name: name,
      territory_type: territoryType,
      value,
      rate_per_100k: territoryType === "municipality" ? ratePer100k(value, DATA.population_by_municipality[name]) : null,
      yoy_absolute_change: diff,
      yoy_percent_change: previous ? round1((diff / previous) * 100) : null
    };
  });

  rows.sort((a, b) => rankingValue(b, mode) - rankingValue(a, mode));
  const rankedRows = rows.map((row, index) => ({ ...row, rank: index + 1 }));
  rankingCache.set(cacheKey, rankedRows);
  return rankedRows;
}

export async function getGovernorPerformance(): Promise<GovernorPerformanceResponse> {
  return DATA.governor_performance;
}

export async function getMethodology(): Promise<Methodology> {
  return DATA.methodology;
}

export async function getMapData(
  indicator = "letalidade_violenta",
  mode: RankingMode = "count",
  year = DATA.latest_period.year,
  month = DATA.latest_period.month
): Promise<GeoFeatureCollection> {
  const cacheKey = `map:${indicator}:${mode}:${year}:${month}`;
  const cached = mapCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const municipalityRankings = await getRankings(indicator, mode, "municipality", year, month);
  const byMunicipality = new Map(municipalityRankings.map((row) => [row.territory_name, row]));
  const features = DATA.municipality_geometries.features.map((feature) => {
    const territoryName = String(feature.properties?.territory_name ?? "");
    const row = byMunicipality.get(territoryName);
    return featureWithStats(feature, row, mode, "Município");
  });

  const ranked = [...features].sort((a, b) => Number(b.properties.metric_value ?? 0) - Number(a.properties.metric_value ?? 0));
  ranked.forEach((feature, index) => {
    feature.properties.rank = Number(feature.properties.metric_value ?? 0) > 0 ? index + 1 : null;
  });

  const collection = {
    type: "FeatureCollection",
    features
  } satisfies GeoFeatureCollection;
  mapCache.set(cacheKey, collection);
  return collection;
}

export async function getCrimeRateMapData(
  year = DATA.latest_period.year,
  month = DATA.latest_period.month
): Promise<GeoFeatureCollection> {
  const cacheKey = `map:crime_geral:state:${year}:${month}`;
  const cached = mapCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const periodIndex = monthIndex(year, month);
  const features = DATA.municipality_geometries.features.map((feature) => {
    const territoryName = String(feature.properties?.territory_name ?? "");
    const population = DATA.population_by_municipality[territoryName] ?? null;
    const value = rollingCrimeValue("municipality", territoryName, periodIndex);
    return featureWithCrimeRate(feature, value, population, "Município");
  });
  rankFeatures(features);
  const collection = { type: "FeatureCollection", features } satisfies GeoFeatureCollection;
  mapCache.set(cacheKey, collection);
  return collection;
}

export async function getRioCityMapData(
  indicator = "letalidade_violenta",
  mode: RankingMode = "count",
  year = DATA.latest_period.year,
  month = DATA.latest_period.month
): Promise<GeoFeatureCollection> {
  const cacheKey = `map:rio:${indicator}:${mode}:${year}:${month}`;
  const cached = mapCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const policeAreaRankings = await getRankings(indicator, mode, "police_area", year, month);
  const byPoliceArea = new Map(policeAreaRankings.map((row) => [row.territory_name, row]));
  const features = DATA.rio_neighborhood_geometries.features.map((feature) => {
    const sourceTerritoryName = String(feature.properties?.source_territory_name ?? "");
    const row = sourceTerritoryName ? byPoliceArea.get(sourceTerritoryName) : undefined;
    return featureWithStats(feature, row, mode, "Bairro/CISP");
  });

  const ranked = [...features].sort((a, b) => Number(b.properties.metric_value ?? 0) - Number(a.properties.metric_value ?? 0));
  ranked.forEach((feature, index) => {
    feature.properties.rank = Number(feature.properties.metric_value ?? 0) > 0 ? index + 1 : null;
  });

  const collection = {
    type: "FeatureCollection",
    features
  } satisfies GeoFeatureCollection;
  mapCache.set(cacheKey, collection);
  return collection;
}

export async function getRioCityCrimeRateMapData(
  year = DATA.latest_period.year,
  month = DATA.latest_period.month
): Promise<GeoFeatureCollection> {
  const cacheKey = `map:crime_geral:rio:${year}:${month}`;
  const cached = mapCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const periodIndex = monthIndex(year, month);
  const populationByPoliceArea = rioPopulationByPoliceArea();
  const features = DATA.rio_neighborhood_geometries.features.map((feature) => {
    const sourceTerritoryName = String(feature.properties?.source_territory_name ?? "");
    const population = sourceTerritoryName ? populationByPoliceArea[sourceTerritoryName] ?? null : null;
    const value = sourceTerritoryName ? rollingCrimeValue("police_area", sourceTerritoryName, periodIndex) : 0;
    return featureWithCrimeRate(feature, value, population, "Bairro/CISP");
  });
  rankFeatures(features);
  const collection = { type: "FeatureCollection", features } satisfies GeoFeatureCollection;
  mapCache.set(cacheKey, collection);
  return collection;
}

export async function getLatestChanges(): Promise<LatestChangesResponse> {
  const latest = DATA.latest_period;
  return {
    latest_period: latest,
    sections: [
      changeSection("Municípios com maior piora", "municipality", "increase", latest.year, latest.month),
      changeSection("Municípios com maior queda", "municipality", "decrease", latest.year, latest.month),
      changeSection("CISPs com maior piora", "police_area", "increase", latest.year, latest.month),
      changeSection("CISPs com maior queda", "police_area", "decrease", latest.year, latest.month)
    ]
  };
}

function changeSection(
  title: string,
  territoryType: Exclude<TerritoryType, "state">,
  direction: "increase" | "decrease",
  year: number,
  month: number
) {
  const periodIndex = monthIndex(year, month);
  const previousIndex = monthIndex(year - 1, month);
  const names = Object.keys(DATA.series.letalidade_violenta?.[territoryType] ?? {});
  const rows = names
    .map((name) => {
      const currentValue = rollingCrimeValue(territoryType, name, periodIndex);
      const previousValue = rollingCrimeValue(territoryType, name, previousIndex);
      const absoluteChange = round1(currentValue - previousValue);
      return {
        rank: 0,
        territory_name: name,
        territory_type: territoryType,
        current_value: currentValue,
        previous_value: previousValue,
        absolute_change: absoluteChange,
        percent_change: previousValue > 0 ? round1((absoluteChange / previousValue) * 100) : null
      };
    })
    .filter((row) => row.previous_value > 0 || row.current_value > 0)
    .sort((a, b) => direction === "increase" ? b.absolute_change - a.absolute_change : a.absolute_change - b.absolute_change)
    .slice(0, 12)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return { title, territory_type: territoryType, direction, rows };
}

function featureWithCrimeRate(
  feature: GeoFeatureCollection["features"][number],
  value: number,
  population: number | null,
  mapUnitType: string
): GeoFeatureCollection["features"][number] {
  const rate = population && population > 0 ? round1((value / population) * 100000) : null;
  return {
    ...feature,
    properties: {
      ...feature.properties,
      map_unit_type: mapUnitType,
      rank: null,
      value,
      population,
      rate_per_100k: rate,
      metric_value: rate ?? 0
    }
  };
}

function featureWithStats(
  feature: GeoFeatureCollection["features"][number],
  row: RankingRow | undefined,
  mode: RankingMode,
  mapUnitType: string
): GeoFeatureCollection["features"][number] {
  return {
    ...feature,
    properties: {
      ...feature.properties,
      map_unit_type: mapUnitType,
      rank: null,
      value: row?.value ?? 0,
      rate_per_100k: row?.rate_per_100k ?? null,
      yoy_absolute_change: row?.yoy_absolute_change ?? null,
      yoy_percent_change: row?.yoy_percent_change ?? null,
      metric_value: row ? rankingValue(row, mode) : 0
    }
  };
}

function rollingCrimeValue(territoryType: TerritoryType, territoryName: string, periodIndex: number): number {
  if (periodIndex < 0) {
    return 0;
  }
  const start = Math.max(0, periodIndex - 11);
  let total = 0;
  for (const indicator of CRIME_RATE_INDICATORS) {
    const values = DATA.series[indicator]?.[territoryType]?.[territoryName] ?? [];
    for (let index = start; index <= periodIndex; index += 1) {
      total += values[index] ?? 0;
    }
  }
  return round1(total);
}

function rioPopulationByPoliceArea(): Record<string, number> {
  const output: Record<string, number> = {};
  for (const feature of DATA.rio_neighborhood_geometries.features) {
    const sourceTerritoryName = String(feature.properties?.source_territory_name ?? "");
    const population = Number(feature.properties?.population ?? 0);
    if (sourceTerritoryName && population > 0) {
      output[sourceTerritoryName] = (output[sourceTerritoryName] ?? 0) + population;
    }
  }
  return output;
}

function rankFeatures(features: GeoFeatureCollection["features"]) {
  const ranked = [...features].sort((a, b) => Number(b.properties.metric_value ?? 0) - Number(a.properties.metric_value ?? 0));
  ranked.forEach((feature, index) => {
    feature.properties.rank = Number(feature.properties.metric_value ?? 0) > 0 ? index + 1 : null;
  });
}

function valuesFor(indicator: string, territoryType: TerritoryType, territoryName?: string): number[] {
  const resolvedName = resolveTerritoryName(territoryType, territoryName);
  return DATA.series[indicator]?.[territoryType]?.[resolvedName] ?? [];
}

function resolveTerritoryName(territoryType: TerritoryType, territoryName?: string): string {
  if (territoryType === "state") {
    return "Estado do Rio de Janeiro";
  }
  if (!territoryName) {
    return DATA.territories[territoryType]?.[0]?.name ?? "";
  }
  if (territoryType === "police_area" && /^CISP\s+\d+/i.test(territoryName)) {
    return DATA.territorial_units.find((unit) => unit.police_area_name === territoryName)?.territorial_unit ?? territoryName;
  }
  return territoryName;
}

function ytd(values: number[], year: number, month: number): number {
  let total = 0;
  for (let currentMonth = 1; currentMonth <= month; currentMonth += 1) {
    const index = monthIndex(year, currentMonth);
    if (index >= 0) {
      total += values[index] ?? 0;
    }
  }
  return round1(total);
}

function historicalMinYtd(values: number[], month: number): { year: number; value: number } | null {
  let best: { year: number; value: number } | null = null;
  for (let year = DATA.analysis_start_year; year <= DATA.latest_period.year; year += 1) {
    const value = ytd(values, year, month);
    if (value <= 0) {
      continue;
    }
    if (!best || value < best.value) {
      best = { year, value };
    }
  }
  return best;
}

function yearValues(values: number[], year: number): number[] {
  const maxMonth = year === DATA.latest_period.year ? DATA.latest_period.month : 12;
  const output: number[] = [];
  for (let month = 1; month <= maxMonth; month += 1) {
    output.push(values[monthIndex(year, month)] ?? 0);
  }
  return output;
}

function movingAverage(values: number[], index: number): number | null {
  const start = Math.max(0, index - 2);
  const slice = values.slice(start, index + 1);
  if (slice.length === 0) {
    return null;
  }
  return round1(slice.reduce((sum, value) => sum + value, 0) / slice.length);
}

function monthIndex(year: number, month: number): number {
  return DATA.month_keys.indexOf(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`);
}

function splitMonthKey(key: string): { year: number; month: number } {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

function periodDate(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function ratePer100k(value: number, population?: number): number | null {
  if (!population || population <= 0) {
    return null;
  }
  return round1((value / population) * 100000);
}

function rankingValue(row: RankingRow, mode: RankingMode): number {
  if (mode === "rate") {
    return row.rate_per_100k ?? 0;
  }
  if (mode === "yoy") {
    return row.yoy_percent_change ?? Number.NEGATIVE_INFINITY;
  }
  return row.value;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
