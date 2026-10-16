/**
 * Camada de dados do site. Tudo é calculado a partir do snapshot estático gerado pelo ETL para cada
 * UF (`<basePath>/data/<uf>/static-data.generated.json`), buscado com fetch: `DataGate` carrega o
 * núcleo da UF da página e o instala com `setCore` antes de renderizar a tela; os getters abaixo
 * leem o núcleo instalado.
 *
 * As séries do snapshot são esparsas: `{ from: "AAAA-MM", values: [...] }`. Meses sem dado
 * são `null` e nunca entram em somas, mínimos ou variações — "sem dado" não é zero.
 */

import { configFor, dataUrl, setCurrentUf, ufConfig } from "@/lib/uf";
import type {
  AnnualPoint,
  ChangeRow,
  ChangeSection,
  Coverage,
  DataSource,
  GeoFeatureCollection,
  GovernorPerformanceResponse,
  GovernorTerm,
  Indicator,
  LatestChangesResponse,
  LatestPeriod,
  Methodology,
  MonthlyPoint,
  PopulationYear,
  RankingMode,
  RankingRow,
  SnapshotMeta,
  SummaryCardData,
  SummaryResponse,
  TerritorialUnit,
  Territory,
  TerritoryType
} from "@/types/api";

type SparseSeries = { from: string; values: Array<number | null> };
export type Snapshot = {
  generated_at: string;
  analysis_start_year: number;
  uf: string;
  name: string;
  latest_period: LatestPeriod;
  month_keys: string[];
  indicators: Indicator[];
  crime_general_components?: string[];
  territories: Record<TerritoryType, Territory[]>;
  territorial_units: TerritorialUnit[];
  population_by_municipality: Record<string, number>;
  population_history: {
    state: Record<string, PopulationYear>;
    municipality: Record<string, Record<string, PopulationYear>>;
  };
  governor_terms: GovernorTerm[];
  mayor_terms?: Record<string, GovernorTerm[]>;
  governor_performance: GovernorPerformanceResponse;
  sources: DataSource[];
  methodology: Methodology;
  series: Record<string, Partial<Record<TerritoryType, Record<string, SparseSeries>>>>;
  coverage: Coverage;
  fogo_cruzado?: FogoCruzado;
};
export type FogoCruzado = {
  indicators: Indicator[];
  territory_types: string[];
  coverage: { first_month?: string | null; last_month?: string | null; months?: number; occurrences?: number; unmatched_municipalities?: Record<string, number>; unmatched_neighborhoods?: Record<string, number>; [key: string]: unknown };
  source: { name: string; url: string; attribution: string; last_update?: string | null; [key: string]: unknown };
};

// --- Núcleo da UF corrente -----------------------------------------------------------------

let UF_CODE = "";
let DATA = {} as Snapshot;
let MONTHS: string[] = [];
let MONTH_INDEX = new Map<string, number>();
let LATEST: LatestPeriod = { year: 0, month: 0 } as LatestPeriod;
let LATEST_INDEX = -1;

const coreCache = new Map<string, Promise<Snapshot>>();

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

/** Busca (uma vez por UF) o núcleo de dados. */
export function loadCore(code: string): Promise<Snapshot> {
  let pending = coreCache.get(code);
  if (!pending) {
    pending = fetchJson<Snapshot>(dataUrl(code, "static-data.generated.json"));
    pending.catch(() => coreCache.delete(code));
    coreCache.set(code, pending);
  }
  return pending;
}

/** Instala o núcleo que as telas vão ler. Chamado por DataGate antes de renderizar a tela. */
export function setCore(code: string, snapshot: Snapshot): void {
  if (code === UF_CODE && snapshot === DATA) {
    return;
  }
  UF_CODE = code;
  DATA = snapshot;
  MONTHS = snapshot.month_keys;
  MONTH_INDEX = new Map(MONTHS.map((key, index) => [key, index]));
  LATEST = snapshot.latest_period;
  LATEST_INDEX = monthIndex(LATEST.year, LATEST.month);
  denseCache.clear();
  rankingCache.clear();
  mapCache.clear();
  setCurrentUf(code);
}

/** Nome do estado no snapshot ("Estado do Rio de Janeiro"). */
export function stateName(): string {
  return DATA.territories.state[0]?.name ?? ufConfig().stateName;
}
/** Capital da UF: município padrão dos seletores e das faixas de prefeito. */
export function capitalName(): string {
  return ufConfig().capital;
}
/** Indicadores somados no agregado "crime geral" (rankings, mudanças e mapa); a soma vem pronta do ETL. */
export function crimeRateIndicators(): string[] {
  return DATA.crime_general_components ?? ["letalidade_violenta", "roubo_rua", "roubo_veiculo", "roubo_carga", "estupro"];
}
export const CRIME_GENERAL_CODE = "crime_geral";
/** Indicador padrão de rankings, mapa e mudanças (crime geral no Rio, homicídio doloso nas demais). */
export function localIndicator(): string {
  return ufConfig().localIndicator;
}

const denseCache = new Map<string, Array<number | null>>();
const rankingCache = new Map<string, RankingRow[]>();
const mapCache = new Map<string, GeoFeatureCollection>();

// --- Séries por município e área policial: um arquivo por indicador, carregado quando o recorte pede ---

type DetailSeries = Partial<Record<Exclude<TerritoryType, "state">, Record<string, SparseSeries>>>;
const detailCache = new Map<string, DetailSeries>();
const pendingLoads = new Map<string, Promise<void>>();

/** As séries por município e área policial destes indicadores já estão em memória? O estado vem no snapshot. */
export function isSeriesLoaded(indicators: string[], territoryType: TerritoryType): boolean {
  return territoryType === "state" || indicators.every((code) => detailCache.has(`${UF_CODE}:${code}`));
}

/** Carrega `static-series/<indicador>.generated.json` para cada indicador que ainda falta. */
export async function loadSeries(indicators: string[], territoryType: TerritoryType = "municipality"): Promise<void> {
  if (territoryType === "state") {
    return;
  }
  const uf = UF_CODE;
  await Promise.all(indicators.filter((code) => !detailCache.has(`${uf}:${code}`)).map((code) => loadDetail(uf, code)));
}

function loadDetail(uf: string, code: string): Promise<void> {
  const key = `${uf}:${code}`;
  const pending = pendingLoads.get(key);
  if (pending) {
    return pending;
  }
  const load = fetchJson<DetailSeries>(dataUrl(uf, `static-series/${code}.generated.json`))
    .then((detail) => {
      detailCache.set(key, detail);
    })
    .catch(() => {
      // Indicador sem arquivo (ou falha de rede): fica sem séries em vez de tentar para sempre.
      detailCache.set(key, {});
    })
    .finally(() => {
      pendingLoads.delete(key);
    });
  pendingLoads.set(key, load);
  return load;
}

function detail(code: string): DetailSeries | undefined {
  return detailCache.get(`${UF_CODE}:${code}`);
}

// --- Metadados ------------------------------------------------------------------------------

export function getSnapshotMeta(): SnapshotMeta {
  return {
    generated_at: DATA.generated_at,
    analysis_start_year: DATA.analysis_start_year,
    latest_period: LATEST,
    coverage: DATA.coverage
  };
}

export function getLatestPeriod(): LatestPeriod {
  return LATEST;
}

export function getIndicators(): Indicator[] {
  return DATA.indicators;
}

export function getIndicator(code: string): Indicator | undefined {
  if (code === CRIME_GENERAL_CODE) {
    return { code, name: "Crime geral", category: "Indicador agregado", unit: "ocorrencias", source_name: "snapshot" };
  }
  return DATA.indicators.find((indicator) => indicator.code === code);
}

/**
 * Indicadores que têm pelo menos um mês de dado para o território. Antes de as séries do
 * recorte chegarem, vale a cobertura do tipo de território (todos os que o ISP publica nele).
 */
export function getIndicatorsFor(territoryType: TerritoryType, territoryName?: string): Indicator[] {
  const name = resolveTerritoryName(territoryType, territoryName);
  if (!isSeriesLoaded(DATA.indicators.map((indicator) => indicator.code), territoryType)) {
    return DATA.indicators.filter((indicator) => Boolean(DATA.coverage.first_month_by_indicator[indicator.code]?.[territoryType]));
  }
  return DATA.indicators.filter((indicator) => Boolean(sparseFor(indicator.code, territoryType, name)));
}

/**
 * Indicadores com dado por município ou área policial, para rankings e mapa. O crime geral entra
 * primeiro quando existe nesses recortes (no Rio); os que só têm série estadual ficam de fora.
 */
export function getLocalIndicators(): Indicator[] {
  const local = DATA.indicators.filter((indicator) => {
    const coverage = DATA.coverage.first_month_by_indicator[indicator.code];
    return Boolean(coverage?.municipality || coverage?.police_area);
  });
  const general = getIndicator(CRIME_GENERAL_CODE);
  return localIndicator() === CRIME_GENERAL_CODE && general ? [general, ...local] : local;
}

export function getTerritories(territoryType: TerritoryType): Territory[] {
  return (DATA.territories[territoryType] ?? []).filter((territory) => !isIgnoredTerritory(territory.name));
}

export function getTerritorialUnits(municipality = capitalName()): TerritorialUnit[] {
  return DATA.territorial_units.filter((unit) => unit.municipality === municipality);
}

export function getGovernorTerms(): GovernorTerm[] {
  return DATA.governor_terms;
}

/** Prefeitos de um município (hoje só a cidade do Rio), para as faixas de mandato. */
export function getMayorTerms(municipality: string): GovernorTerm[] {
  return DATA.mayor_terms?.[municipality] ?? [];
}

export function getGovernorPerformance(): GovernorPerformanceResponse {
  return DATA.governor_performance;
}

/** Fonte opcional de tiroteios; null quando o snapshot foi gerado sem credenciais. */
export function getFogoCruzado(): FogoCruzado | null {
  return DATA.fogo_cruzado ?? null;
}

/** Territórios presentes no arquivo já carregado de um indicador (bairros do Rio, por exemplo). */
export function loadedTerritoryNames(indicator: string, territoryType: Exclude<TerritoryType, "state">): string[] {
  return Object.keys(detail(indicator)?.[territoryType] ?? {}).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function getDataSources(): DataSource[] {
  return DATA.sources;
}

export function getMethodology(): Methodology {
  return DATA.methodology;
}

/** Primeiro mês com dado de um indicador num tipo de território ("AAAA-MM"). */
export function getFirstMonth(indicator: string, territoryType: TerritoryType): string | null {
  return DATA.coverage.first_month_by_indicator[indicator]?.[territoryType] ?? null;
}

export function getPopulation(territoryType: TerritoryType, territoryName: string, year: number): PopulationYear | null {
  if (territoryType === "state") {
    return DATA.population_history.state[String(year)] ?? null;
  }
  if (territoryType === "municipality") {
    return DATA.population_history.municipality[territoryName]?.[String(year)] ?? null;
  }
  return null;
}

// --- Resumo (cartões) --------------------------------------------------------------------

export function getSummary(territoryType: TerritoryType = "state", territoryName?: string): SummaryResponse {
  const name = resolveTerritoryName(territoryType, territoryName);
  const year = LATEST.year;
  const latestMonth = LATEST.month;
  const cards = DATA.indicators.flatMap((indicator): SummaryCardData[] => {
    const values = denseValues(indicator.code, territoryType, name);
    const current = ytd(values, year, latestMonth);
    if (current === null) {
      return [];
    }
    const previous = ytd(values, year - 1, latestMonth);
    const diff = previous === null ? null : round1(current - previous);
    const extremes = ytdExtremes(values, latestMonth, year);
    const population = getPopulation(territoryType, name, year);
    return [
      {
        indicator: indicator.code,
        name: indicator.name,
        category: indicator.category,
        unit: indicator.unit,
        year,
        latest_month: latestMonth,
        current_year_value: current,
        previous_year_same_period: previous,
        yoy_absolute_change: diff,
        yoy_percent_change: diff !== null && previous ? round1((diff / previous) * 100) : null,
        historical_min: extremes.min,
        historical_max: extremes.max,
        rate_per_100k: population ? ratePer100k(current, population.value) : null,
        first_year: firstYearWithData(values) ?? year,
        annual_history: annualSeries(values, territoryType, name)
          .filter((point) => point.complete && point.value !== null)
          .map((point) => ({ year: point.year, value: point.value as number }))
      }
    ];
  });

  return { year, latest_month: latestMonth, territory_type: territoryType, territory_name: name, cards };
}

// --- Séries ---------------------------------------------------------------------------------

export function getAnnualSeries(indicator: string, territoryType: TerritoryType = "state", territoryName?: string): AnnualPoint[] {
  const name = resolveTerritoryName(territoryType, territoryName);
  return annualSeries(denseValues(indicator, territoryType, name), territoryType, name);
}

export function getMonthlySeries(
  indicator: string,
  territoryType: TerritoryType = "state",
  territoryName?: string,
  startYear = DATA.analysis_start_year,
  endYear = LATEST.year
): MonthlyPoint[] {
  const name = resolveTerritoryName(territoryType, territoryName);
  const values = denseValues(indicator, territoryType, name);
  const points: MonthlyPoint[] = [];
  for (let index = 0; index <= LATEST_INDEX; index += 1) {
    const { year, month } = splitMonthKey(MONTHS[index]);
    if (year < startYear || year > endYear) {
      continue;
    }
    const value = values[index] ?? null;
    const previousValue = index >= 12 ? values[index - 12] ?? null : null;
    points.push({
      period_date: periodDate(year, month),
      year,
      month,
      value,
      rolling_12: rollingSum(values, index, 12),
      previous_year_value: previousValue,
      yoy_percent_change: value !== null && previousValue ? round1(((value - previousValue) / previousValue) * 100) : null
    });
  }
  return points;
}

function annualSeries(values: Array<number | null>, territoryType: TerritoryType, name: string): AnnualPoint[] {
  const firstYear = firstYearWithData(values);
  if (firstYear === null) {
    return [];
  }
  const points: AnnualPoint[] = [];
  for (let year = firstYear; year <= LATEST.year; year += 1) {
    const lastMonth = year === LATEST.year ? LATEST.month : 12;
    let total = 0;
    let months = 0;
    for (let month = 1; month <= lastMonth; month += 1) {
      const value = values[monthIndex(year, month)];
      if (value !== null && value !== undefined) {
        total += value;
        months += 1;
      }
    }
    const value = months > 0 ? round1(total) : null;
    const complete = months === 12;
    const previousSamePeriod = ytd(values, year - 1, lastMonth);
    const previousPoint = points[points.length - 1];
    const previousComplete = previousPoint && previousPoint.complete ? previousPoint.value : null;
    const comparison = complete ? previousComplete : previousSamePeriod;
    const population = getPopulation(territoryType, name, year);
    points.push({
      year,
      value,
      months_with_data: months,
      complete,
      previous_same_period: previousSamePeriod,
      yoy_percent_change: value !== null && comparison ? round1(((value - comparison) / comparison) * 100) : null,
      population: population?.value ?? null,
      population_interpolated: population?.interpolated ?? false,
      rate_per_100k: complete && value !== null && population ? ratePer100k(value, population.value) : null
    });
  }
  return points;
}

// --- Rankings e mudanças -------------------------------------------------------------------

export function getRankings(
  indicator = "letalidade_violenta",
  mode: RankingMode = "count",
  territoryType: Exclude<TerritoryType, "state"> = "municipality",
  year = LATEST.year,
  month = LATEST.month
): RankingRow[] {
  const period = clampPeriod(year, month);
  const cacheKey = `${UF_CODE}:${indicator}:${mode}:${territoryType}:${period.year}:${period.month}`;
  const cached = rankingCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const loaded = isSeriesLoaded([indicator], territoryType);
  const rows = getTerritories(territoryType).flatMap((territory): RankingRow[] => {
    const name = territory.name;
    const values = denseValues(indicator, territoryType, name);
    const value = ytd(values, period.year, period.month);
    if (value === null) {
      return [];
    }
    const previous = ytd(values, period.year - 1, period.month);
    const diff = previous === null ? null : round1(value - previous);
    const population = getPopulation(territoryType, name, period.year);
    return [
      {
        rank: 0,
        territory_name: name,
        territory_type: territoryType,
        value,
        rate_per_100k: population ? ratePer100k(value, population.value) : null,
        yoy_absolute_change: diff,
        yoy_percent_change: diff !== null && previous ? round1((diff / previous) * 100) : null,
        ...trendFor(previous, value, diff)
      }
    ];
  });

  const visibleRows = rows.filter((row) => row.value > 0 || (row.rate_per_100k ?? 0) > 0 || (row.yoy_absolute_change ?? 0) !== 0);
  visibleRows.sort((a, b) => rankingValue(b, mode) - rankingValue(a, mode));
  const rankedRows = visibleRows.map((row, index) => ({ ...row, rank: index + 1 }));
  if (loaded) {
    rankingCache.set(cacheKey, rankedRows);
  }
  return rankedRows;
}

export async function getLatestChanges(): Promise<LatestChangesResponse> {
  await loadSeries([localIndicator()]);
  return {
    latest_period: LATEST,
    sections: [
      changeSection("Municípios com maior alta", "municipality", "increase"),
      changeSection("Municípios com maior queda", "municipality", "decrease"),
      changeSection(`${ufConfig().policeAreaChangesLabel} com maior alta`, "police_area", "increase"),
      changeSection(`${ufConfig().policeAreaChangesLabel} com maior queda`, "police_area", "decrease")
    ]
  };
}

function changeSection(title: string, territoryType: Exclude<TerritoryType, "state">, direction: "increase" | "decrease"): ChangeSection {
  const rows = getTerritories(territoryType)
    .flatMap((territory): ChangeRow[] => {
      const values = denseValues(localIndicator(), territoryType, territory.name);
      const currentValue = rollingSum(values, LATEST_INDEX, 12);
      const previousValue = rollingSum(values, LATEST_INDEX - 12, 12);
      if (currentValue === null || previousValue === null) {
        return [];
      }
      const absoluteChange = round1(currentValue - previousValue);
      return [
        {
          rank: 0,
          territory_name: territory.name,
          territory_type: territoryType,
          current_value: currentValue,
          previous_value: previousValue,
          absolute_change: absoluteChange,
          percent_change: previousValue > 0 ? round1((absoluteChange / previousValue) * 100) : null
        }
      ];
    })
    .filter((row) => (direction === "increase" ? row.absolute_change > 0 : row.absolute_change < 0))
    .sort((a, b) => (direction === "increase" ? b.absolute_change - a.absolute_change : a.absolute_change - b.absolute_change))
    .slice(0, 12)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  return { title, territory_type: territoryType, direction, rows };
}

// --- Mapa -----------------------------------------------------------------------------------

type GeoFile = { municipality_geometries: GeoFeatureCollection; rio_neighborhood_geometries: GeoFeatureCollection };
const geoCache = new Map<string, Promise<GeoFile>>();

async function loadGeo(): Promise<GeoFile> {
  let pending = geoCache.get(UF_CODE);
  if (!pending) {
    pending = fetchJson(dataUrl(UF_CODE, "static-geo.generated.json"));
    pending.catch(() => geoCache.delete(UF_CODE));
    geoCache.set(UF_CODE, pending);
  }
  return pending;
}

export async function getMapData(
  indicator = CRIME_GENERAL_CODE,
  mode: RankingMode = "rate",
  view: "state" | "rio_city" = "state",
  year = LATEST.year,
  month = LATEST.month
): Promise<GeoFeatureCollection> {
  const period = clampPeriod(year, month);
  const cacheKey = `${UF_CODE}:${view}:${indicator}:${mode}:${period.year}:${period.month}`;
  const cached = mapCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const territoryType: Exclude<TerritoryType, "state"> = view === "rio_city" ? "police_area" : "municipality";
  const [geo] = await Promise.all([loadGeo(), loadSeries([indicator], territoryType)]);
  const rankings = getRankings(indicator, mode, territoryType, period.year, period.month);
  const byName = new Map(rankings.map((row) => [row.territory_name, row]));
  const base = view === "rio_city" ? geo.rio_neighborhood_geometries : geo.municipality_geometries;
  const populationByPoliceArea = view === "rio_city" ? rioPopulationByPoliceArea(geo.rio_neighborhood_geometries) : {};

  const features = base.features.map((feature) => {
    const key = String(view === "rio_city" ? feature.properties?.source_territory_name ?? "" : feature.properties?.territory_name ?? "");
    const row = key ? byName.get(key) : undefined;
    // Bairros do Rio não têm população oficial por CISP no IBGE; usa-se a soma dos bairros (Censo 2022).
    const rate = row && view === "rio_city" && populationByPoliceArea[key] ? ratePer100k(row.value, populationByPoliceArea[key]) : row?.rate_per_100k ?? null;
    const metric = row ? (mode === "rate" ? rate ?? 0 : mode === "yoy" ? row.yoy_percent_change ?? Number.NEGATIVE_INFINITY : row.value) : 0;
    return {
      ...feature,
      properties: {
        ...feature.properties,
        map_unit_type: view === "rio_city" ? "Bairro/CISP" : "Município",
        rank: null as number | null,
        value: row?.value ?? null,
        rate_per_100k: rate,
        yoy_absolute_change: row?.yoy_absolute_change ?? null,
        yoy_percent_change: row?.yoy_percent_change ?? null,
        has_data: Boolean(row),
        metric_value: Number.isFinite(metric) ? metric : 0
      }
    };
  });
  const ranked = [...features]
    .filter((feature) => feature.properties.has_data)
    .sort((a, b) => Number(b.properties.metric_value) - Number(a.properties.metric_value));
  ranked.forEach((feature, index) => {
    feature.properties.rank = index + 1;
  });
  const collection: GeoFeatureCollection = { type: "FeatureCollection", features };
  mapCache.set(cacheKey, collection);
  return collection;
}

function rioPopulationByPoliceArea(collection: GeoFeatureCollection): Record<string, number> {
  const output: Record<string, number> = {};
  for (const feature of collection.features) {
    const sourceTerritoryName = String(feature.properties?.source_territory_name ?? "");
    const population = Number(feature.properties?.population ?? 0);
    if (sourceTerritoryName && population > 0) {
      output[sourceTerritoryName] = (output[sourceTerritoryName] ?? 0) + population;
    }
  }
  return output;
}

// --- Utilidades -----------------------------------------------------------------------------

export function monthIndex(year: number, month: number): number {
  return MONTH_INDEX.get(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`) ?? -1;
}

export function monthKeyAt(index: number): string | undefined {
  return MONTHS[index];
}

export function resolveTerritoryName(territoryType: TerritoryType, territoryName?: string): string {
  if (territoryType === "state") {
    return stateName();
  }
  if (!territoryName) {
    return territoryType === "municipality" ? capitalName() : DATA.territories[territoryType]?.[0]?.name ?? "";
  }
  if (territoryType === "police_area" && /^CISP\s+\d+/i.test(territoryName)) {
    return DATA.territorial_units.find((unit) => unit.police_area_name === territoryName)?.territorial_unit ?? territoryName;
  }
  return territoryName;
}

function sparseFor(indicator: string, territoryType: TerritoryType, name: string): SparseSeries | undefined {
  if (territoryType === "state") {
    return DATA.series[indicator]?.state?.[name];
  }
  return detail(indicator)?.[territoryType]?.[name];
}

/** Série alinhada a `month_keys`; meses fora da cobertura ficam `null`. */
function denseValues(indicator: string, territoryType: TerritoryType, name: string): Array<number | null> {
  const cacheKey = `${indicator}:${territoryType}:${name}`;
  const cached = denseCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  if (!isSeriesLoaded([indicator], territoryType)) {
    // Ainda sem o arquivo do indicador: tudo "sem dado", e sem guardar em cache.
    return new Array<number | null>(MONTHS.length).fill(null);
  }
  const dense: Array<number | null> = new Array(MONTHS.length).fill(null);
  const sparse = sparseFor(indicator, territoryType, name);
  if (sparse) {
    const start = MONTH_INDEX.get(sparse.from) ?? -1;
    if (start >= 0) {
      sparse.values.forEach((value, offset) => {
        if (start + offset < dense.length) {
          dense[start + offset] = value;
        }
      });
    }
  }
  denseCache.set(cacheKey, dense);
  return dense;
}

/** Soma de janeiro até `month` de `year`; null quando nenhum mês tem dado. */
function ytd(values: Array<number | null>, year: number, month: number): number | null {
  let total = 0;
  let months = 0;
  for (let currentMonth = 1; currentMonth <= month; currentMonth += 1) {
    const value = values[monthIndex(year, currentMonth)];
    if (value !== null && value !== undefined) {
      total += value;
      months += 1;
    }
  }
  return months > 0 ? round1(total) : null;
}

function ytdExtremes(values: Array<number | null>, month: number, untilYear: number) {
  let min: { year: number; value: number } | null = null;
  let max: { year: number; value: number } | null = null;
  for (let year = DATA.analysis_start_year; year <= untilYear; year += 1) {
    const value = ytd(values, year, month);
    if (value === null) {
      continue;
    }
    if (!min || value < min.value) {
      min = { year, value };
    }
    if (!max || value > max.value) {
      max = { year, value };
    }
  }
  return { min, max };
}

function rollingSum(values: Array<number | null>, endIndex: number, window: number): number | null {
  const start = endIndex - window + 1;
  if (start < 0 || endIndex >= values.length) {
    return null;
  }
  let total = 0;
  for (let index = start; index <= endIndex; index += 1) {
    const value = values[index];
    if (value === null || value === undefined) {
      return null;
    }
    total += value;
  }
  return round1(total);
}

function firstYearWithData(values: Array<number | null>): number | null {
  const index = values.findIndex((value) => value !== null && value !== undefined);
  return index >= 0 ? splitMonthKey(MONTHS[index]).year : null;
}

function splitMonthKey(key: string): { year: number; month: number } {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

function clampPeriod(year: number, month: number): { year: number; month: number } {
  if (year > LATEST.year || (year === LATEST.year && month > LATEST.month)) {
    return { year: LATEST.year, month: LATEST.month };
  }
  return { year, month };
}

function periodDate(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function ratePer100k(value: number, population: number): number | null {
  if (!population || population <= 0) {
    return null;
  }
  return round1((value / population) * 100000);
}

function rankingValue(row: RankingRow, mode: RankingMode): number {
  if (mode === "rate") {
    return row.rate_per_100k ?? Number.NEGATIVE_INFINITY;
  }
  if (mode === "yoy") {
    return row.yoy_percent_change ?? Number.NEGATIVE_INFINITY;
  }
  return row.value;
}

function trendFor(previous: number | null, current: number, diff: number | null): Pick<RankingRow, "trend_status" | "trend_label"> {
  if (previous === null || diff === null || previous <= 0 || (previous < 10 && current < 10)) {
    return { trend_status: "inconclusive", trend_label: "Inconclusivo" };
  }
  const percent = (diff / previous) * 100;
  if (percent >= 10 && diff >= 3) {
    return { trend_status: "worse", trend_label: "Em alta" };
  }
  if (percent <= -10 && diff <= -3) {
    return { trend_status: "better", trend_label: "Em queda" };
  }
  return { trend_status: "stable", trend_label: "Estável" };
}

function isIgnoredTerritory(name: string) {
  return name.trim().localeCompare("Não Informado", "pt-BR", { sensitivity: "base" }) === 0;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
