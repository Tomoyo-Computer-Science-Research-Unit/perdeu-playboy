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
  brazil_state_geometries?: GeoFeatureCollection;
};
type StateSnapshot = Omit<StaticSnapshot, "generated_at" | "analysis_start_year" | "month_keys" | "governor_performance" | "states"> & {
  uf?: string;
  name?: string;
  coverage?: Record<string, unknown>;
};

const DATA = snapshot as StaticSnapshot;
const CRIME_RATE_INDICATORS = ["letalidade_violenta", "roubo_rua", "roubo_veiculo", "roubo_carga", "estupro"];
const NATIONAL_COMPARABLE_CRIME_INDICATORS = CRIME_RATE_INDICATORS.filter((indicator) => indicator !== "roubo_rua");
const GOVERNOR_INDICATORS = ["letalidade_violenta", "homicidio_doloso", "latrocinio", "roubo_veiculo", "roubo_carga"];
const rankingCache = new Map<string, RankingRow[]>();
const mapCache = new Map<string, GeoFeatureCollection>();

const PRESIDENT_TERMS = [
  { governor: "Dilma Rousseff", party_or_condition: "PT", term_start: "2015-01-01", term_end: "2016-08-31" },
  { governor: "Michel Temer", party_or_condition: "PMDB / MDB", term_start: "2016-08-31", term_end: "2018-12-31" },
  { governor: "Jair Bolsonaro", party_or_condition: "PSL / PL", term_start: "2019-01-01", term_end: "2022-12-31" },
  { governor: "Luiz Inácio Lula da Silva", party_or_condition: "PT", term_start: "2023-01-01", term_end: null }
];

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

const SC_GOVERNOR_TERMS = [
  { governor: "Raimundo Colombo", party_or_condition: "PSD", term_start: "2011-01-01", term_end: "2018-04-06" },
  { governor: "Eduardo Pinho Moreira", party_or_condition: "MDB", term_start: "2018-04-06", term_end: "2018-12-31" },
  { governor: "Carlos Moisés", party_or_condition: "PSL / Republicanos", term_start: "2019-01-01", term_end: "2022-12-31" },
  { governor: "Jorginho Mello", party_or_condition: "PL", term_start: "2023-01-01", term_end: null }
];

const RS_GOVERNOR_TERMS = [
  { governor: "Tarso Genro", party_or_condition: "PT", term_start: "2011-01-01", term_end: "2014-12-31" },
  { governor: "José Ivo Sartori", party_or_condition: "PMDB", term_start: "2015-01-01", term_end: "2018-12-31" },
  { governor: "Eduardo Leite", party_or_condition: "PSDB", term_start: "2019-01-01", term_end: "2022-03-31" },
  { governor: "Ranolfo Vieira Júnior", party_or_condition: "PSDB", term_start: "2022-03-31", term_end: "2022-12-31" },
  { governor: "Eduardo Leite", party_or_condition: "PSDB / PSD", term_start: "2023-01-01", term_end: null }
];

const MG_GOVERNOR_TERMS = [
  { governor: "Fernando Pimentel", party_or_condition: "PT", term_start: "2015-01-01", term_end: "2018-12-31" },
  { governor: "Romeu Zema", party_or_condition: "Novo", term_start: "2019-01-01", term_end: null }
];

const ES_GOVERNOR_TERMS = [
  { governor: "Paulo Hartung", party_or_condition: "PMDB / MDB", term_start: "2015-01-01", term_end: "2018-12-31" },
  { governor: "Renato Casagrande", party_or_condition: "PSB", term_start: "2019-01-01", term_end: null }
];

const GO_GOVERNOR_TERMS = [
  { governor: "Marconi Perillo", party_or_condition: "PSDB", term_start: "2015-01-01", term_end: "2018-04-06" },
  { governor: "José Eliton", party_or_condition: "PSDB", term_start: "2018-04-06", term_end: "2018-12-31" },
  { governor: "Ronaldo Caiado", party_or_condition: "DEM / União Brasil", term_start: "2019-01-01", term_end: null }
];

const MT_GOVERNOR_TERMS = [
  { governor: "Pedro Taques", party_or_condition: "PDT", term_start: "2015-01-01", term_end: "2018-12-31" },
  { governor: "Mauro Mendes", party_or_condition: "DEM / União Brasil", term_start: "2019-01-01", term_end: null }
];

const MS_GOVERNOR_TERMS = [
  { governor: "Reinaldo Azambuja", party_or_condition: "PSDB", term_start: "2015-01-01", term_end: "2022-12-31" },
  { governor: "Eduardo Riedel", party_or_condition: "PSDB", term_start: "2023-01-01", term_end: null }
];

const DF_GOVERNOR_TERMS = [
  { governor: "Rodrigo Rollemberg", party_or_condition: "PSB", term_start: "2015-01-01", term_end: "2018-12-31" },
  { governor: "Ibaneis Rocha", party_or_condition: "MDB", term_start: "2019-01-01", term_end: null }
];

const MA_GOVERNOR_TERMS = [
  { governor: "Flávio Dino", party_or_condition: "PCdoB", term_start: "2015-01-01", term_end: "2022-04-02" },
  { governor: "Carlos Brandão", party_or_condition: "PSB", term_start: "2022-04-02", term_end: null }
];

const PI_GOVERNOR_TERMS = [
  { governor: "Wellington Dias", party_or_condition: "PT", term_start: "2015-01-01", term_end: "2022-03-31" },
  { governor: "Regina Sousa", party_or_condition: "PT", term_start: "2022-04-01", term_end: "2022-12-31" },
  { governor: "Rafael Fonteles", party_or_condition: "PT", term_start: "2023-01-01", term_end: null }
];

const CE_GOVERNOR_TERMS = [
  { governor: "Camilo Santana", party_or_condition: "PT", term_start: "2015-01-01", term_end: "2022-04-02" },
  { governor: "Izolda Cela", party_or_condition: "PDT", term_start: "2022-04-02", term_end: "2022-12-31" },
  { governor: "Elmano de Freitas", party_or_condition: "PT", term_start: "2023-01-01", term_end: null }
];

const RN_GOVERNOR_TERMS = [
  { governor: "Robinson Faria", party_or_condition: "PSD", term_start: "2015-01-01", term_end: "2018-12-31" },
  { governor: "Fátima Bezerra", party_or_condition: "PT", term_start: "2019-01-01", term_end: null }
];

const PB_GOVERNOR_TERMS = [
  { governor: "Ricardo Coutinho", party_or_condition: "PSB", term_start: "2015-01-01", term_end: "2018-12-31" },
  { governor: "João Azevêdo", party_or_condition: "PSB / Cidadania", term_start: "2019-01-01", term_end: null }
];

const PE_GOVERNOR_TERMS = [
  { governor: "Paulo Câmara", party_or_condition: "PSB", term_start: "2015-01-01", term_end: "2022-12-31" },
  { governor: "Raquel Lyra", party_or_condition: "PSDB", term_start: "2023-01-01", term_end: null }
];

const AL_GOVERNOR_TERMS = [
  { governor: "Renan Filho", party_or_condition: "MDB", term_start: "2015-01-01", term_end: "2022-04-01" },
  { governor: "Paulo Dantas", party_or_condition: "MDB", term_start: "2022-05-15", term_end: null }
];

const SE_GOVERNOR_TERMS = [
  { governor: "Jackson Barreto", party_or_condition: "MDB", term_start: "2015-01-01", term_end: "2018-12-31" },
  { governor: "Belivaldo Chagas", party_or_condition: "PSD", term_start: "2019-01-01", term_end: "2022-12-31" },
  { governor: "Fábio Mitidieri", party_or_condition: "PSD", term_start: "2023-01-01", term_end: null }
];

const BA_GOVERNOR_TERMS = [
  { governor: "Rui Costa", party_or_condition: "PT", term_start: "2015-01-01", term_end: "2022-12-31" },
  { governor: "Jerônimo Rodrigues", party_or_condition: "PT", term_start: "2023-01-01", term_end: null }
];

const RO_GOVERNOR_TERMS = [
  { governor: "Confúcio Moura", party_or_condition: "MDB", term_start: "2015-01-01", term_end: "2018-12-31" },
  { governor: "Marcos Rocha", party_or_condition: "PSL / União Brasil", term_start: "2019-01-01", term_end: null }
];

const AC_GOVERNOR_TERMS = [
  { governor: "Tião Viana", party_or_condition: "PT", term_start: "2015-01-01", term_end: "2018-12-31" },
  { governor: "Gladson Cameli", party_or_condition: "PP", term_start: "2019-01-01", term_end: null }
];

const AM_GOVERNOR_TERMS = [
  { governor: "José Melo", party_or_condition: "PROS", term_start: "2015-01-01", term_end: "2017-05-31" },
  { governor: "Amazonino Mendes", party_or_condition: "PDT", term_start: "2017-06-01", term_end: "2018-12-31" },
  { governor: "Wilson Lima", party_or_condition: "PSC / União Brasil", term_start: "2019-01-01", term_end: null }
];

const RR_GOVERNOR_TERMS = [
  { governor: "Suely Campos", party_or_condition: "PP", term_start: "2015-01-01", term_end: "2018-12-31" },
  { governor: "Antônio Denarium", party_or_condition: "PSL / PP", term_start: "2019-01-01", term_end: null }
];

const PA_GOVERNOR_TERMS = [
  { governor: "Simão Jatene", party_or_condition: "PSDB", term_start: "2015-01-01", term_end: "2018-12-31" },
  { governor: "Helder Barbalho", party_or_condition: "MDB", term_start: "2019-01-01", term_end: null }
];

const AP_GOVERNOR_TERMS = [
  { governor: "Waldez Góes", party_or_condition: "PDT", term_start: "2015-01-01", term_end: "2022-12-31" },
  { governor: "Clécio Luís", party_or_condition: "Solidariedade", term_start: "2023-01-01", term_end: null }
];

const TO_GOVERNOR_TERMS = [
  { governor: "Marcelo Miranda", party_or_condition: "MDB", term_start: "2015-01-01", term_end: "2018-04-04" },
  { governor: "Mauro Carlesse", party_or_condition: "PSL", term_start: "2018-04-04", term_end: "2022-09-25" },
  { governor: "Wanderlei Barbosa", party_or_condition: "Republicanos", term_start: "2022-09-25", term_end: null }
];

let brazilAggregate: StateSnapshot | null = null;

// Builds a synthetic "Brasil" snapshot that aggregates every state. Each state is
// mapped into the "municipality" slot so the existing municipality-level map,
// rankings and changes logic renders the 27 states as the unit, while the
// "state" slot holds the national rollup ("Brasil").
function getBrazilAggregate(): StateSnapshot {
  if (brazilAggregate) {
    return brazilAggregate;
  }
  const states = DATA.states ?? {};
  const codes = Object.keys(states).filter((code) => code !== "BR");
  const latestIndex = Math.min(
    ...codes.map((code) => monthIndex(states[code].latest_period.year, states[code].latest_period.month))
  );
  const latestKey = DATA.month_keys[Math.max(0, latestIndex)] ?? DATA.month_keys[DATA.month_keys.length - 1];
  const latestParts = splitMonthKey(latestKey);
  const monthCount = DATA.month_keys.length;
  const nameByCode: Record<string, string> = {};
  for (const code of codes) {
    nameByCode[code] = states[code].name ?? code;
  }

  const indicatorCodes = new Set<string>();
  for (const code of codes) {
    for (const indicator of Object.keys(states[code].series ?? {})) {
      indicatorCodes.add(indicator);
    }
  }

  const series: SeriesStore = {};
  for (const indicator of indicatorCodes) {
    const national = new Array<number>(monthCount).fill(0);
    const byState: Record<string, number[]> = {};
    for (const code of codes) {
      const stateBucket = states[code].series[indicator]?.state ?? {};
      const stateSeries = new Array<number>(monthCount).fill(0);
      for (const key of Object.keys(stateBucket)) {
        const values = stateBucket[key] ?? [];
        for (let index = 0; index < monthCount; index += 1) {
          stateSeries[index] += values[index] ?? 0;
        }
      }
      byState[nameByCode[code]] = stateSeries;
      for (let index = 0; index < monthCount; index += 1) {
        national[index] += stateSeries[index];
      }
    }
    series[indicator] = { state: { Brasil: national }, municipality: byState, police_area: {} };
  }

  const population: Record<string, number> = {};
  for (const code of codes) {
    const pops = states[code].population_by_municipality ?? {};
    population[nameByCode[code]] = Object.values(pops).reduce((sum, value) => sum + (value || 0), 0);
  }

  brazilAggregate = {
    uf: "BR",
    name: "Brasil",
    latest_period: {
      year: latestParts.year,
      month: latestParts.month,
      period_date: periodDate(latestParts.year, latestParts.month),
      source_name: "ISP / SSP-SP / Sinesp"
    },
    indicators: DATA.indicators,
    territories: {
      state: [{ territory_type: "state", name: "Brasil" }],
      municipality: codes.map((code) => ({ territory_type: "municipality", name: nameByCode[code] })),
      police_area: []
    },
    territorial_units: [],
    population_by_municipality: population,
    municipality_geometries: DATA.brazil_state_geometries ?? { type: "FeatureCollection", features: [] },
    rio_neighborhood_geometries: { type: "FeatureCollection", features: [] },
    sources: uniqueSources(codes.flatMap((code) => states[code].sources ?? [])),
    methodology: DATA.methodology,
    series,
    coverage: { state_start_year: 2015, municipality_start_year: 2015, police_area_start_year: null, map_drilldown: null }
  } as StateSnapshot;
  return brazilAggregate;
}

function stateData(uf?: string): StateSnapshot {
  const code = enabledUf(uf);
  if (code === "BR") {
    return getBrazilAggregate();
  }
  return DATA.states?.[code] ?? DATA;
}

function uniqueSources(sources: DataSource[]): DataSource[] {
  const output = new Map<string, DataSource>();
  for (const source of sources) {
    output.set(`${source.name}:${source.url}:${source.file_name}`, source);
  }
  return [...output.values()];
}

export async function getIndicators(uf?: string): Promise<Indicator[]> {
  const data = stateData(uf);
  return indicatorsWithData(data);
}

export async function getMapIndicators(uf?: string, view: "state" | "rio_city" = "state"): Promise<Indicator[]> {
  const data = stateData(uf);
  const territoryType: TerritoryType = view === "rio_city" && enabledUf(uf) === "RJ" ? "police_area" : "municipality";
  return data.indicators.filter((indicator) => indicatorHasTerritoryData(indicator.code, territoryType, data));
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
  if (code === "BR") {
    return governorPerformanceForState(
      stateData("BR"),
      PRESIDENT_TERMS,
      "Comparação descritiva por mandato presidencial com dados oficiais disponíveis para o Brasil."
    );
  }
  if (code === "SP") {
    return governorPerformanceForState(stateData("SP"), SP_GOVERNOR_TERMS);
  }
  if (code === "PR") {
    return governorPerformanceForState(stateData("PR"), PR_GOVERNOR_TERMS);
  }
  if (code === "SC") {
    return governorPerformanceForState(stateData("SC"), SC_GOVERNOR_TERMS);
  }
  if (code === "RS") {
    return governorPerformanceForState(stateData("RS"), RS_GOVERNOR_TERMS);
  }
  if (code === "MG") {
    return governorPerformanceForState(stateData("MG"), MG_GOVERNOR_TERMS);
  }
  if (code === "ES") {
    return governorPerformanceForState(stateData("ES"), ES_GOVERNOR_TERMS);
  }
  if (code === "GO") {
    return governorPerformanceForState(stateData("GO"), GO_GOVERNOR_TERMS);
  }
  if (code === "MT") {
    return governorPerformanceForState(stateData("MT"), MT_GOVERNOR_TERMS);
  }
  if (code === "MS") {
    return governorPerformanceForState(stateData("MS"), MS_GOVERNOR_TERMS);
  }
  if (code === "DF") {
    return governorPerformanceForState(stateData("DF"), DF_GOVERNOR_TERMS);
  }
  if (code === "MA") {
    return governorPerformanceForState(stateData("MA"), MA_GOVERNOR_TERMS);
  }
  if (code === "PI") {
    return governorPerformanceForState(stateData("PI"), PI_GOVERNOR_TERMS);
  }
  if (code === "CE") {
    return governorPerformanceForState(stateData("CE"), CE_GOVERNOR_TERMS);
  }
  if (code === "RN") {
    return governorPerformanceForState(stateData("RN"), RN_GOVERNOR_TERMS);
  }
  if (code === "PB") {
    return governorPerformanceForState(stateData("PB"), PB_GOVERNOR_TERMS);
  }
  if (code === "PE") {
    return governorPerformanceForState(stateData("PE"), PE_GOVERNOR_TERMS);
  }
  if (code === "AL") {
    return governorPerformanceForState(stateData("AL"), AL_GOVERNOR_TERMS);
  }
  if (code === "SE") {
    return governorPerformanceForState(stateData("SE"), SE_GOVERNOR_TERMS);
  }
  if (code === "BA") {
    return governorPerformanceForState(stateData("BA"), BA_GOVERNOR_TERMS);
  }
  if (code === "RO") {
    return governorPerformanceForState(stateData("RO"), RO_GOVERNOR_TERMS);
  }
  if (code === "AC") {
    return governorPerformanceForState(stateData("AC"), AC_GOVERNOR_TERMS);
  }
  if (code === "AM") {
    return governorPerformanceForState(stateData("AM"), AM_GOVERNOR_TERMS);
  }
  if (code === "RR") {
    return governorPerformanceForState(stateData("RR"), RR_GOVERNOR_TERMS);
  }
  if (code === "PA") {
    return governorPerformanceForState(stateData("PA"), PA_GOVERNOR_TERMS);
  }
  if (code === "AP") {
    return governorPerformanceForState(stateData("AP"), AP_GOVERNOR_TERMS);
  }
  if (code === "TO") {
    return governorPerformanceForState(stateData("TO"), TO_GOVERNOR_TERMS);
  }
  return DATA.governor_performance;
}

export async function getMethodology(): Promise<Methodology> {
  return DATA.methodology;
}

export async function getMapData(
  indicator = "letalidade_violenta",
  mode: RankingMode = "rate",
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
  const unitLabel = enabledUf(uf) === "BR" ? "UF" : "Município";
  const features = data.municipality_geometries.features.map((feature) => {
    const territoryName = String(feature.properties?.territory_name ?? "");
    const row = byMunicipality.get(territoryName);
    return featureWithStats(feature, row, mode, unitLabel);
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
  const unitLabel = enabledUf(uf) === "BR" ? "UF" : "Município";
  const features = data.municipality_geometries.features.map((feature) => {
    const territoryName = String(feature.properties?.territory_name ?? "");
    const population = data.population_by_municipality[territoryName] ?? null;
    const value = rollingCrimeValue("municipality", territoryName, periodIndex, data);
    return featureWithCrimeRate(feature, value, population, unitLabel);
  });
  rankFeatures(features);
  const collection = { type: "FeatureCollection", features } satisfies GeoFeatureCollection;
  mapCache.set(cacheKey, collection);
  return collection;
}

export async function getRioCityMapData(
  indicator = "letalidade_violenta",
  mode: RankingMode = "rate",
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
      : code === "BR"
        ? [
            changeSection("UFs com maior piora", "municipality", "increase", latest.year, latest.month, data),
            changeSection("UFs com maior queda", "municipality", "decrease", latest.year, latest.month, data)
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
  const indicators = data.uf === "BR" ? NATIONAL_COMPARABLE_CRIME_INDICATORS : CRIME_RATE_INDICATORS;
  const names = Object.keys(data.series.letalidade_violenta?.[territoryType] ?? {}).filter((name) => !isIgnoredTerritory(name));
  const rows = names
    .map((name) => {
      const currentValue = rollingCrimeValue(territoryType, name, periodIndex, data, indicators);
      const previousValue = rollingCrimeValue(territoryType, name, previousIndex, data, indicators);
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
    .filter((row) => direction === "increase" ? row.absolute_change > 0 : row.absolute_change < 0)
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

function rollingCrimeValue(
  territoryType: TerritoryType,
  territoryName: string,
  periodIndex: number,
  data: StateSnapshot = DATA,
  indicators = CRIME_RATE_INDICATORS
): number {
  if (periodIndex < 0) {
    return 0;
  }
  const start = Math.max(0, periodIndex - 11);
  let total = 0;
  for (const indicator of indicators) {
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
  terms: Array<{ governor: string; party_or_condition: string; term_start: string; term_end: string | null }>,
  methodology = "Comparação descritiva por mandato com dados oficiais disponíveis para a UF selecionada."
): GovernorPerformanceResponse {
  const stateName = resolveTerritoryName("state", undefined, data);
  const coverageStart = stateCoverageStartIndex(data);
  const rows = terms.map((term) => {
    const startIndex = monthIndexFromDate(term.term_start);
    const endIndex = term.term_end ? monthIndexFromDate(term.term_end) : monthIndex(data.latest_period.year, data.latest_period.month);
    const boundedStart = Math.max(coverageStart, startIndex);
    const boundedEnd = Math.min(endIndex, monthIndex(data.latest_period.year, data.latest_period.month));
    const currentValues = GOVERNOR_INDICATORS.map((indicator) => {
      const values = data.series[indicator]?.state?.[stateName] ?? [];
      return annualizedSlice(values, boundedStart, boundedEnd);
    });
    const hasFullBaseline = boundedStart - 12 >= coverageStart;
    const baselineStart = boundedStart - 12;
    const baselineEnd = boundedStart - 1;
    const baselineValues = GOVERNOR_INDICATORS.map((indicator) => {
      if (!hasFullBaseline) {
        return null;
      }
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
    const baselineMonthsCount = hasFullBaseline && baselineEnd >= baselineStart ? baselineEnd - baselineStart + 1 : 0;
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
    methodology,
    indicators: GOVERNOR_INDICATORS,
    rows: ranked
  };
}

function stateCoverageStartIndex(data: StateSnapshot): number {
  const startYear = Number(data.coverage?.state_start_year ?? DATA.analysis_start_year);
  return Number.isFinite(startYear) ? monthIndex(startYear, 1) : 0;
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

function indicatorHasTerritoryData(indicator: string, territoryType: TerritoryType, data: StateSnapshot): boolean {
  const byName = data.series[indicator]?.[territoryType] ?? {};
  return Object.entries(byName).some(([name, values]) =>
    !isIgnoredTerritory(name) && values.some((value) => Number(value) > 0)
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
