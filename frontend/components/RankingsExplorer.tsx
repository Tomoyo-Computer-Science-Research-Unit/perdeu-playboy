"use client";

import { useMemo, useState } from "react";
import { useScreenHotkeys } from "@/components/Hotkeys";
import { RankingTable, type SortDirection, type SortKey } from "@/components/RankingTable";
import { Field, Panel, Screen, Segmented } from "@/components/ui";
import { LOCAL_INDICATOR, getLatestPeriod, getLocalIndicators, getRankings, getSnapshotMeta } from "@/lib/api";
import { UF_CONFIG } from "@/lib/uf";
import { formatPeriodRange, monthLong } from "@/lib/format";
import { useSeries } from "@/lib/use-series";
import type { RankingMode, RankingRow } from "@/types/api";

const MODES: RankingMode[] = ["rate", "count", "yoy"];

export function RankingsExplorer() {
  const latest = getLatestPeriod();
  const coverage = getSnapshotMeta().coverage;
  const [indicator, setIndicator] = useState(LOCAL_INDICATOR);
  const [mode, setMode] = useState<RankingMode>("rate");
  const [year, setYear] = useState(latest.year);
  const [month, setMonth] = useState(latest.month);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection } | null>(null);

  const indicators = useMemo(() => getLocalIndicators(), []);
  const activeIndex = Math.max(0, indicators.findIndex((item) => item.code === indicator));
  const maxMonth = year === latest.year ? latest.month : 12;
  const effectiveMonth = Math.min(month, maxMonth);
  // O arquivo de um indicador traz municípios e CISPs juntos.
  const ready = useSeries([indicator], "municipality");
  const municipalityRows = useMemo(() => sortRows(getRankings(indicator, mode, "municipality", year, effectiveMonth), sort), [indicator, mode, effectiveMonth, sort, year, ready]);
  const policeAreaRows = useMemo(
    () => sortRows(getRankings(indicator, mode === "rate" ? "count" : mode, "police_area", year, effectiveMonth), sort),
    [indicator, mode, effectiveMonth, sort, year, ready]
  );
  const firstYear = Math.min(coverage.municipality_start_year ?? latest.year, coverage.police_area_start_year ?? latest.year);
  const years = Array.from({ length: latest.year - firstYear + 1 }, (_, index) => latest.year - index);

  function handleSort(key: SortKey) {
    setSort((current) => ({ key, direction: current?.key === key && current.direction === "desc" ? "asc" : "desc" }));
  }

  function stepMonth(step: number) {
    let nextYear = year;
    let nextMonth = effectiveMonth + step;
    if (nextMonth < 1) {
      nextYear -= 1;
      nextMonth = 12;
    } else if (nextMonth > 12) {
      nextYear += 1;
      nextMonth = 1;
    }
    if (nextYear < firstYear || nextYear > latest.year || (nextYear === latest.year && nextMonth > latest.month)) {
      return;
    }
    setYear(nextYear);
    setMonth(nextMonth);
  }

  const hotkeys = useMemo(
    () => ({
      ArrowUp: () => setIndicator(indicators[(activeIndex - 1 + indicators.length) % indicators.length].code),
      ArrowDown: () => setIndicator(indicators[(activeIndex + 1) % indicators.length].code),
      ArrowLeft: () => stepMonth(-1),
      ArrowRight: () => stepMonth(1),
      m: () => setMode((current) => MODES[(MODES.indexOf(current) + 1) % MODES.length])
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeIndex, indicators, year, effectiveMonth]
  );
  useScreenHotkeys(hotkeys);

  const periodLabel = formatPeriodRange(year, effectiveMonth);

  return (
    <Screen columns="minmax(0, 1fr) minmax(0, 1fr)" rows="auto minmax(0, 1fr)" className={ready ? "" : "is-loading"}>
      <Panel title={<b>Rankings</b>} style={{ gridColumn: "1 / span 2" }}>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <Field label="Indicador" className="min-w-[240px]">
            <select value={indicator} onChange={(event) => setIndicator(event.target.value)}>
              {indicators.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Segmented
            label="Métrica"
            value={mode}
            onChange={(next) => {
              setMode(next);
              setSort(null);
            }}
            options={[
              { value: "rate", label: "Por 100 mil" },
              { value: "count", label: "Ocorrências" },
              { value: "yoy", label: "Variação" }
            ]}
          />
          <Field label="Ano">
            <select
              value={year}
              onChange={(event) => {
                const nextYear = Number(event.target.value);
                setYear(nextYear);
                setMonth(Math.min(month, nextYear === latest.year ? latest.month : 12));
              }}
            >
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Até o mês">
            <select value={effectiveMonth} onChange={(event) => setMonth(Number(event.target.value))}>
              {Array.from({ length: maxMonth }, (_, index) => index + 1).map((item) => (
                <option key={item} value={item}>
                  {monthLong(item)}
                </option>
              ))}
            </select>
          </Field>
          <span className="ml-auto text-[11px] tracking-[0.06em] text-ash">
            {periodLabel} vs {formatPeriodRange(year - 1, effectiveMonth)}
          </span>
        </div>
      </Panel>

      <Panel title={<b>Municípios</b>} aside={<span>{municipalityRows.length} · desde {coverage.municipality_start_year ?? "–"}</span>} flush>
        <RankingTable rows={municipalityRows} territoryType="municipality" indicator={indicator} sortKey={sort?.key} sortDirection={sort?.direction} onSort={handleSort} />
      </Panel>

      <Panel
        title={<b>{UF_CONFIG.policeAreaPlural}</b>}
        aside={<span>{policeAreaRows.length} · desde {coverage.police_area_start_year ?? "–"}</span>}
        flush
        foot={mode === "rate" ? UF_CONFIG.rateFootPoliceArea : undefined}
      >
        <RankingTable rows={policeAreaRows} territoryType="police_area" indicator={indicator} sortKey={sort?.key} sortDirection={sort?.direction} onSort={handleSort} />
      </Panel>
    </Screen>
  );
}

function sortRows(rows: RankingRow[], sort: { key: SortKey; direction: SortDirection } | null): RankingRow[] {
  if (!sort) {
    return rows;
  }
  const multiplier = sort.direction === "desc" ? -1 : 1;
  return [...rows]
    .sort((a, b) => {
      if (sort.key === "territory") {
        return a.territory_name.localeCompare(b.territory_name, "pt-BR") * multiplier;
      }
      if (sort.key === "trend") {
        return (a.trend_label ?? "").localeCompare(b.trend_label ?? "", "pt-BR") * multiplier;
      }
      const pick = (row: RankingRow) =>
        sort.key === "value" ? row.value : sort.key === "rate" ? row.rate_per_100k ?? Number.NEGATIVE_INFINITY : row.yoy_percent_change ?? Number.NEGATIVE_INFINITY;
      return (pick(a) - pick(b)) * multiplier;
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
