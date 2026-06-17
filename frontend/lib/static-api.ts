import snapshot from "@/lib/static-data.generated.json";
import { enabledUf, type UfCode } from "@/lib/ufs";
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
  states?: Record<string, StateSnapshot>;
};
type StateSnapshot = Omit<StaticSnapshot, "generated_at" | "analysis_start_year" | "month_keys" | "governor_performance" | "states"> & {
  uf?: string;
  name?: string;
  coverage?: Record<string, unknown>;
};

const DATA = snapshot as StaticSnapshot;
const CRIME_RATE_INDICATORS = ["letalidade_violenta", "roubo_rua", "roubo_veiculo", "roubo_carga", "estupro"];
const GOVERNOR_INDICATORS = ["letalidade_violenta", "homicidio_doloso", "latrocinio", "roubo_veiculo", "roubo_carga"];
const rankingCache = new Map<string, RankingRow[]>();
const mapCache = new Map<string, GeoFeatureCollection>();

const SP_GOVERNOR_TERMS = [
  { governor: "Geraldo Alckmin", party_or_condition: "PSDB", term_start: "2015-01-01", term_end: "2018-04-06" },
  { governor: "Márcio França", party_or_condition: "PSB", term_start: "2018-04-06", term_end: "2018-12-31" },
  { governor: "João Doria", party_or_condition: "PSDB", term_start: "2019-01-01", term_end: "2022-03-31" },
  { governor: "Rodrigo Garcia", party_or_condition: "PSDB", term_start: "2022-03-31", term_end: "2022-12-31" },
  { governor: "Tarcísio de Freitas", party_or_condition: "Republicanos", term_start: "2023-01-01", term_end: null }
];

const PR_GOVERNOR_TERMS = [
  { governor: "Beto Richa", party_or_condition: "PSDB", term_start: "2011-01-01", term_end: "2018-04-06" },
  { governor: "Cida Borghetti", party_or_condition: "PP", term_start: "2018-04-06", term_end: "2018-12-31" },
  { governor: "Ratinho Junior", party_or_condition: "PSD", term_start: "2019-01-01", term_end: null }
];

function stateData(uf?: string): StateSnapshot {
  const code = enabledUf(uf);
  return DATA.states?.[code] ?? DATA;
}

export async function getIndicators(uf?: string): Promise<Indicator[]> {
  const data = stateData(uf);
  return indicatorsWithData(data);
}

export async function getLatestPeriod(uf?: string): Promise<StaticSnapshot["latest_period"]> {
  return stateData(uf).latest_period;
}

export async function getSnapshotMeta(): Promise<SnapshotMeta> {
  return {
    generated_at: DATA.generated_at,
    analysis_start_year: DATA.analysis_start_year,
    latest_period: DATA.latest_period
  };
}

export async function getDataSources(uf?: string): Promise<DataSource[]> {
  return stateData(uf).sources ?? [];
}

export async function getTerritories(territoryType: TerritoryType, uf?: string): Promise<Territory[]> {
  return (stateData(uf).territories[territoryType] ?? []).filter((territory) => !isIgnoredTerritory(territory.name));
}

export async function getTerritorialUnits(municipality = "Rio de Janeiro", uf?: string): Promise<TerritorialUnit[]> {
  const data = stateData(uf);
  return data.territorial_units.filter((unit) => unit.municipality === municipality);
}

export async function getSummary(
  year = DATA.latest_period.year,
  territoryType: TerritoryType = "state",
  territoryName?: string,
  uf?: string
): Promise<SummaryResponse> {
  const data = stateData(uf);
  const latest = data.latest_period;
  const latestMonth = year === latest.year ? latest.month : 12;
  const resolvedName = resolveTerritoryName(territoryType, territoryName, data);
  const cards = indicatorsWithData(data).flatMap((indicator): SummaryCardData[] => {
    const values = valuesFor(indicator.code, territoryType, resolvedName, data);
    const current = ytd(values, year, latestMonth);
    const previous = ytd(values, year - 1, latestMonth);
    const historicalMin = historicalMinYtd(values, latestMonth, data);
    if (previous <= 0 || !historicalMin) {
      return [];
    }
    const diff = round1(current - previous);
    const minValue = historicalMin.value;
    return [{
      indicator: indicator.code,
      name: indicator.name,
      current_year_value: current,
      previous_year_same_period: previous,
      historical_min_same_period: minValue,
      historical_min_year: historicalMin.year,
      historical_min_times_lower: minValue > 0 && current > 0 ? round1(current / minValue) : null,
      yoy_absolute_change: diff,
      yoy_percent_change: round1((diff / previous) * 100),
      latest_month: latestMonth,
      sparkline: yearValues(values, year, data)
    }];
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
  endYear = DATA.latest_period.year,
  uf?: string
): Promise<TimeSeriesPoint[]> {
  const data = stateData(uf);
  const resolvedName = resolveTerritoryName(territoryType, territoryName, data);
  const values = valuesFor(indicator, territoryType, resolvedName, data);
  const points: TimeSeriesPoint[] = [];

  for (let index = 0; index < DATA.month_keys.length; index += 1) {
    const { year, month } = splitMonthKey(DATA.month_keys[index]);
    if (year < startYear || year > endYear) {
      continue;
    }
    if (isAfterLatestPeriod(data, year, month)) {
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
  month = DATA.latest_period.month,
  uf?: string
): Promise<RankingRow[]> {
  const data = stateData(uf);
  const period = clampPeriod(data, year, month);
  const cacheKey = `${enabledUf(uf)}:${indicator}:${mode}:${territoryType}:${period.year}:${period.month}`;
  const cached = rankingCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const names = Object.keys((indicator === "crime_geral" ? data.series.letalidade_violenta : data.series[indicator])?.[territoryType] ?? {}).filter((name) => !isIgnoredTerritory(name));
  const rows = names.map((name): RankingRow => {
    const values = indicator === "crime_geral" ? [] : valuesFor(indicator, territoryType, name, data);
    const value = indicator === "crime_geral" ? crimeGeneralYtd(territoryType, name, period.year, period.month, data) : ytd(values, period.year, period.month);
    const previous = indicator === "crime_geral" ? crimeGeneralYtd(territoryType, name, period.year - 1, period.month, data) : ytd(values, period.year - 1, period.month);
    const diff = round1(value - previous);
    return {
      rank: 0,
      territory_name: name,
      territory_type: territoryType,
      value,
      rate_per_100k: territoryType === "municipality" ? ratePer100k(value, data.population_by_municipality[name]) : null,
      yoy_absolute_change: diff,
      yoy_percent_change: previous ? round1((diff / previous) * 100) : null,
      ...trendFor(previous, value, diff)
    };
  });

  const visibleRows = rows.filter((row) => row.value > 0 || (row.rate_per_100k ?? 0) > 0 || row.yoy_absolute_change !== 0);
  visibleRows.sort((a, b) => rankingValue(b, mode) - rankingValue(a, mode));
  const rankedRows = visibleRows.map((row, index) => ({ ...row, rank: index + 1 }));
  rankingCache.set(cacheKey, rankedRows);
  return rankedRows;
}

export async function getGovernorPerformance(uf?: string): Promise<GovernorPerformanceResponse> {
  const code = enabledUf(uf);
  if (code === "SP") {
    return governorPerformanceForState(stateData("SP"), SP_GOVERNOR_TERMS);
  }
  if (code === "PR") {
    return governorPerformanceForState(stateData("PR"), PR_GOVERNOR_TERMS);
  }
  return DATA.governor_performance;
}

export async function getMethodology(): Promise<Methodology> {
  return DATA.methodology;
}

export async function getMapData(
  indicator = "letalidade_violenta",
  mode: RankingMode = "count",
  year = DATA.latest_period.year,
  month = DATA.latest_period.month,
  uf?: string
): Promise<GeoFeatureCollection> {
  const data = stateData(uf);
  const period = clampPeriod(data, year, month);
  const cacheKey = `map:${enabledUf(uf)}:${indicator}:${mode}:${period.year}:${period.month}`;
  const cached = mapCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const municipalityRankings = await getRankings(indicator, mode, "municipality", period.year, period.month, enabledUf(uf));
  const byMunicipality = new Map(municipalityRankings.map((row) => [row.territory_name, row]));
  const features = data.municipality_geometries.features.map((feature) => {
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
  month = DATA.latest_period.month,
  uf?: string
): Promise<GeoFeatureCollection> {
  const data = stateData(uf);
  const period = clampPeriod(data, year, month);
  const cacheKey = `map:crime_geral:${enabledUf(uf)}:state:${period.year}:${period.month}`;
  const cached = mapCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const periodIndex = monthIndex(period.year, period.month);
  const features = data.municipality_geometries.features.map((feature) => {
    const territoryName = String(feature.properties?.territory_name ?? "");
    const population = data.population_by_municipality[territoryName] ?? null;
    const value = rollingCrimeValue("municipality", territoryName, periodIndex, data);
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
  month = DATA.latest_period.month,
  uf?: string
): Promise<GeoFeatureCollection> {
  const data = stateData(uf);
  if (enabledUf(uf) !== "RJ") {
    return { type: "FeatureCollection", features: [] };
  }
  const period = clampPeriod(data, year, month);
  const cacheKey = `map:rio:${indicator}:${mode}:${period.year}:${period.month}`;
  const cached = mapCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const policeAreaRankings = await getRankings(indicator, mode, "police_area", period.year, period.month, "RJ");
  const byPoliceArea = new Map(policeAreaRankings.map((row) => [row.territory_name, row]));
  const features = data.rio_neighborhood_geometries.features.map((feature) => {
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
  month = DATA.latest_period.month,
  uf?: string
): Promise<GeoFeatureCollection> {
  const data = stateData(uf);
  if (enabledUf(uf) !== "RJ") {
    return { type: "FeatureCollection", features: [] };
  }
  const period = clampPeriod(data, year, month);
  const cacheKey = `map:crime_geral:rio:${period.year}:${period.month}`;
  const cached = mapCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const periodIndex = monthIndex(period.year, period.month);
  const populationByPoliceArea = rioPopulationByPoliceArea(data);
  const features = data.rio_neighborhood_geometries.features.map((feature) => {
    const sourceTerritoryName = String(feature.properties?.source_territory_name ?? "");
    const population = sourceTerritoryName ? populationByPoliceArea[sourceTerritoryName] ?? null : null;
    const value = sourceTerritoryName ? rollingCrimeValue("police_area", sourceTerritoryName, periodIndex, data) : 0;
    return featureWithCrimeRate(feature, value, population, "Bairro/CISP");
  });
  rankFeatures(features);
  const collection = { type: "FeatureCollection", features } satisfies GeoFeatureCollection;
  mapCache.set(cacheKey, collection);
  return collection;
}

export async function getLatestChanges(uf?: string): Promise<LatestChangesResponse> {
  const data = stateData(uf);
  const code = enabledUf(uf);
  const latest = data.latest_period;
  const sections =
    code === "RJ"
      ? [
          changeSection("Municípios com maior piora", "municipality", "increase", latest.year, latest.month, data),
          changeSection("Municípios com maior queda", "municipality", "decrease", latest.year, latest.month, data),
          changeSection("CISPs com maior piora", "police_area", "increase", latest.year, latest.month, data),
          changeSection("CISPs com maior queda", "police_area", "decrease", latest.year, latest.month, data)
        ]
      : [
          changeSection("Municípios com maior piora", "municipality", "increase", latest.year, latest.month, data),
          changeSection("Municípios com maior queda", "municipality", "decrease", latest.year, latest.month, data)
        ];
  return {
    latest_period: latest,
    sections
  };
}

function changeSection(
  title: string,
  territoryType: Exclude<TerritoryType, "state">,
  direction: "increase" | "decrease",
  year: number,
  month: number,
  data: StateSnapshot = DATA
) {
  const periodIndex = monthIndex(year, month);
  const previousIndex = monthIndex(year - 1, month);
  const names = Object.keys(data.series.letalidade_violenta?.[territoryType] ?? {}).filter((name) => !isIgnoredTerritory(name));
  const rows = names
    .map((name) => {
      const currentValue = rollingCrimeValue(territoryType, name, periodIndex, data);
      const previousValue = rollingCrimeValue(territoryType, name, previousIndex, data);
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

function rollingCrimeValue(territoryType: TerritoryType, territoryName: string, periodIndex: number, data: StateSnapshot = DATA): number {
  if (periodIndex < 0) {
    return 0;
  }
  const start = Math.max(0, periodIndex - 11);
  let total = 0;
  for (const indicator of CRIME_RATE_INDICATORS) {
    const values = data.series[indicator]?.[territoryType]?.[territoryName] ?? [];
    for (let index = start; index <= periodIndex; index += 1) {
      total += values[index] ?? 0;
    }
  }
  return round1(total);
}

function crimeGeneralYtd(
  territoryType: TerritoryType,
  territoryName: string,
  year: number,
  month: number,
  data: StateSnapshot = DATA
): number {
  let total = 0;
  for (const indicator of CRIME_RATE_INDICATORS) {
    total += ytd(data.series[indicator]?.[territoryType]?.[territoryName] ?? [], year, month);
  }
  return round1(total);
}

function rioPopulationByPoliceArea(data: StateSnapshot = DATA): Record<string, number> {
  const output: Record<string, number> = {};
  for (const feature of data.rio_neighborhood_geometries.features) {
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

function indicatorsWithData(data: StateSnapshot): Indicator[] {
  return data.indicators.filter((indicator) => indicatorHasData(indicator.code, data));
}

function governorPerformanceForState(
  data: StateSnapshot,
  terms: Array<{ governor: string; party_or_condition: string; term_start: string; term_end: string | null }>
): GovernorPerformanceResponse {
  const stateName = resolveTerritoryName("state", undefined, data);
  const rows = terms.map((term) => {
    const startIndex = monthIndexFromDate(term.term_start);
    const endIndex = term.term_end ? monthIndexFromDate(term.term_end) : monthIndex(data.latest_period.year, data.latest_period.month);
    const boundedStart = Math.max(0, startIndex);
    const boundedEnd = Math.min(endIndex, monthIndex(data.latest_period.year, data.latest_period.month));
    const currentValues = GOVERNOR_INDICATORS.map((indicator) => {
      const values = data.series[indicator]?.state?.[stateName] ?? [];
      return annualizedSlice(values, boundedStart, boundedEnd);
    });
    const baselineStart = Math.max(0, boundedStart - 12);
    const baselineEnd = boundedStart - 1;
    const baselineValues = GOVERNOR_INDICATORS.map((indicator) => {
      const values = data.series[indicator]?.state?.[stateName] ?? [];
      return annualizedSlice(values, baselineStart, baselineEnd);
    });
    const reductions = currentValues
      .map((currentValue, index) => {
        const baselineValue = baselineValues[index];
        if (baselineValue === null || currentValue === null || baselineValue <= 0) {
          return null;
        }
        return round1(((baselineValue - currentValue) / baselineValue) * 100);
      })
      .filter((value): value is number => value !== null);
    const indicatorResults = GOVERNOR_INDICATORS.map((indicator, index) => ({
      indicator,
      reduction: baselineValues[index] && currentValues[index] !== null && baselineValues[index]! > 0
        ? round1(((baselineValues[index]! - currentValues[index]!) / baselineValues[index]!) * 100)
        : null
    })).filter((item): item is { indicator: string; reduction: number } => item.reduction !== null);
    const rankedIndicators = [...indicatorResults].sort((a, b) => b.reduction - a.reduction);
    const monthsCount = boundedEnd >= boundedStart ? boundedEnd - boundedStart + 1 : 0;
    const baselineMonthsCount = baselineEnd >= baselineStart ? baselineEnd - baselineStart + 1 : 0;
    return {
      rank: null,
      governor: term.governor,
      party_or_condition: term.party_or_condition,
      term_start: term.term_start,
      term_end: term.term_end,
      months_count: monthsCount,
      baseline_months_count: baselineMonthsCount,
      average_reduction_percent: reductions.length ? round1(reductions.reduce((sum, value) => sum + value, 0) / reductions.length) : null,
      annualized_current_value: sumNullable(currentValues),
      annualized_baseline_value: sumNullable(baselineValues),
      best_indicator: rankedIndicators[0]?.indicator ?? null,
      worst_indicator: rankedIndicators[rankedIndicators.length - 1]?.indicator ?? null,
      note: reductions.length ? null : "sem base anterior"
    };
  });
  const ranked = [...rows]
    .sort((a, b) => (b.average_reduction_percent ?? Number.NEGATIVE_INFINITY) - (a.average_reduction_percent ?? Number.NEGATIVE_INFINITY))
    .map((row, index) => ({ ...row, rank: row.average_reduction_percent === null ? null : index + 1 }));
  return {
    methodology: "Comparação descritiva por mandato com dados oficiais disponíveis para a UF selecionada.",
    indicators: GOVERNOR_INDICATORS,
    rows: ranked
  };
}

function annualizedSlice(values: number[], startIndex: number, endIndex: number): number | null {
  if (startIndex < 0 || endIndex < startIndex) {
    return null;
  }
  const slice = values.slice(startIndex, endIndex + 1).filter((value) => Number.isFinite(value));
  if (slice.length === 0) {
    return null;
  }
  const total = slice.reduce((sum, value) => sum + value, 0);
  return round1((total / slice.length) * 12);
}

function sumNullable(values: Array<number | null>): number | null {
  const available = values.filter((value): value is number => value !== null);
  return available.length ? round1(available.reduce((sum, value) => sum + value, 0)) : null;
}

function monthIndexFromDate(value: string): number {
  const [year, month] = value.slice(0, 7).split("-").map(Number);
  return monthIndex(year, month);
}

function indicatorHasData(indicator: string, data: StateSnapshot): boolean {
  const byTerritoryType = data.series[indicator] ?? {};
  return Object.values(byTerritoryType).some((byName) =>
    Object.entries(byName).some(([name, values]) => !isIgnoredTerritory(name) && values.some((value) => Number(value) > 0))
  );
}

function isIgnoredTerritory(name: string) {
  return name.trim().localeCompare("Não Informado", "pt-BR", { sensitivity: "base" }) === 0;
}

function valuesFor(indicator: string, territoryType: TerritoryType, territoryName?: string, data: StateSnapshot = DATA): number[] {
  const resolvedName = resolveTerritoryName(territoryType, territoryName, data);
  return data.series[indicator]?.[territoryType]?.[resolvedName] ?? [];
}

function resolveTerritoryName(territoryType: TerritoryType, territoryName?: string, data: StateSnapshot = DATA): string {
  if (territoryType === "state") {
    return data.territories.state?.[0]?.name ?? "Estado do Rio de Janeiro";
  }
  if (!territoryName) {
    return data.territories[territoryType]?.[0]?.name ?? "";
  }
  if (territoryType === "police_area" && /^CISP\s+\d+/i.test(territoryName)) {
    return data.territorial_units.find((unit) => unit.police_area_name === territoryName)?.territorial_unit ?? territoryName;
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

function historicalMinYtd(values: number[], month: number, data: StateSnapshot = DATA): { year: number; value: number } | null {
  let best: { year: number; value: number } | null = null;
  for (let year = DATA.analysis_start_year; year <= data.latest_period.year; year += 1) {
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

function yearValues(values: number[], year: number, data: StateSnapshot = DATA): number[] {
  const maxMonth = year === data.latest_period.year ? data.latest_period.month : 12;
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

function clampPeriod(data: StateSnapshot, year: number, month: number): { year: number; month: number } {
  if (isAfterLatestPeriod(data, year, month)) {
    return {
      year: data.latest_period.year,
      month: data.latest_period.month
    };
  }
  return { year, month };
}

function isAfterLatestPeriod(data: StateSnapshot, year: number, month: number): boolean {
  return year > data.latest_period.year || (year === data.latest_period.year && month > data.latest_period.month);
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
    return row.rate_per_100k ?? row.value;
  }
  if (mode === "yoy") {
    return row.yoy_percent_change ?? Number.NEGATIVE_INFINITY;
  }
  return row.value;
}

function trendFor(previous: number, current: number, diff: number): Pick<RankingRow, "trend_status" | "trend_label"> {
  if (previous < 10 && current < 10) {
    return { trend_status: "inconclusive", trend_label: "Inconclusivo" };
  }
  if (previous <= 0) {
    return { trend_status: "inconclusive", trend_label: "Inconclusivo" };
  }
  const percent = (diff / previous) * 100;
  if (percent >= 10 && diff >= 3) {
    return { trend_status: "worse", trend_label: "Piorando" };
  }
  if (percent <= -10 && diff <= -3) {
    return { trend_status: "better", trend_label: "Melhorando" };
  }
  return { trend_status: "stable", trend_label: "Estável" };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
