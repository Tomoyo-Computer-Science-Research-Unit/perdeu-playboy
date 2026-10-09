"use client";

import { useMemo, useState } from "react";
import { RankingTable, type SortDirection, type SortKey } from "@/components/RankingTable";
import { Field, SectionHeading, Segmented } from "@/components/ui";
import { CRIME_GENERAL_CODE, getIndicator, getIndicators, getLatestPeriod, getRankings, getSnapshotMeta } from "@/lib/api";
import { formatPeriodRange, monthLong } from "@/lib/format";
import type { RankingMode, RankingRow } from "@/types/api";

export function RankingsExplorer() {
  const latest = getLatestPeriod();
  const coverage = getSnapshotMeta().coverage;
  const [indicator, setIndicator] = useState(CRIME_GENERAL_CODE);
  const [mode, setMode] = useState<RankingMode>("rate");
  const [year, setYear] = useState(latest.year);
  const [month, setMonth] = useState(latest.month);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection } | null>(null);
  const [showAll, setShowAll] = useState({ municipality: false, police_area: false });
  const LIMIT = 25;

  const indicators = useMemo(() => {
    const general = getIndicator(CRIME_GENERAL_CODE);
    return general ? [general, ...getIndicators()] : getIndicators();
  }, []);
  const municipalityRows = useMemo(() => sortRows(getRankings(indicator, mode, "municipality", year, month), sort), [indicator, mode, month, sort, year]);
  const policeAreaRows = useMemo(() => sortRows(getRankings(indicator, mode === "rate" ? "count" : mode, "police_area", year, month), sort), [indicator, mode, month, sort, year]);
  const firstYear = Math.min(coverage.municipality_start_year ?? latest.year, coverage.police_area_start_year ?? latest.year);
  const years = Array.from({ length: latest.year - firstYear + 1 }, (_, index) => latest.year - index);
  const maxMonth = year === latest.year ? latest.month : 12;

  function handleSort(key: SortKey) {
    setSort((current) => ({ key, direction: current?.key === key && current.direction === "desc" ? "asc" : "desc" }));
  }

  const periodLabel = formatPeriodRange(year, Math.min(month, maxMonth));

  return (
    <div className="grid gap-12">
      <section className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <Field label="Indicador">
          <select value={indicator} onChange={(event) => setIndicator(event.target.value)} className="min-w-[260px]">
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
        <div className="flex gap-2">
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
            <select value={Math.min(month, maxMonth)} onChange={(event) => setMonth(Number(event.target.value))}>
              {Array.from({ length: maxMonth }, (_, index) => index + 1).map((item) => (
                <option key={item} value={item}>
                  {monthLong(item)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="grid gap-5">
        <SectionHeading
          title="Municípios"
          sub={`Acumulado de ${periodLabel}, comparado com os mesmos meses do ano anterior. Taxas usam a população do ano (IBGE). Série municipal desde ${coverage.municipality_start_year ?? "2014"}.`}
        />
        <RankingTable rows={municipalityRows} territoryType="municipality" sortKey={sort?.key} sortDirection={sort?.direction} onSort={handleSort} limit={showAll.municipality ? undefined : LIMIT} />
        {municipalityRows.length > LIMIT ? (
          <button type="button" className="btn btn--ghost justify-self-start" onClick={() => setShowAll((current) => ({ ...current, municipality: !current.municipality }))}>
            {showAll.municipality ? `Mostrar só os ${LIMIT} primeiros` : `Ver todos os ${municipalityRows.length} municípios`}
          </button>
        ) : null}
      </section>

      <section className="grid gap-5">
        <SectionHeading
          title="Áreas integradas de segurança pública (CISP)"
          sub={`Acumulado de ${periodLabel}. Sem denominador populacional oficial por CISP, o ranking é por ocorrências${mode === "rate" ? " (a taxa não se aplica)" : ""}. Série desde ${coverage.police_area_start_year ?? "2003"}.`}
        />
        <RankingTable rows={policeAreaRows} territoryType="police_area" sortKey={sort?.key} sortDirection={sort?.direction} onSort={handleSort} limit={showAll.police_area ? undefined : LIMIT} />
        {policeAreaRows.length > LIMIT ? (
          <button type="button" className="btn btn--ghost justify-self-start" onClick={() => setShowAll((current) => ({ ...current, police_area: !current.police_area }))}>
            {showAll.police_area ? `Mostrar só as ${LIMIT} primeiras` : `Ver todas as ${policeAreaRows.length} áreas`}
          </button>
        ) : null}
      </section>
    </div>
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
