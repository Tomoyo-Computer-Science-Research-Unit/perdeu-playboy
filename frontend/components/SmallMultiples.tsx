import { formatNumber, formatPercent } from "@/lib/format";
import type { AnnualPoint, Indicator } from "@/types/api";

type Item = { indicator: Indicator; points: AnnualPoint[] };

/** Grade de mini-gráficos anuais: um por indicador, mesma escala temporal, escala vertical própria. */
export function SmallMultiples({ items, startYear, endYear, onOpen }: { items: Item[]; startYear: number; endYear: number; onOpen?: (code: string) => void }) {
  const years = Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);

  return (
    <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(({ indicator, points }) => {
        const byYear = new Map(points.map((point) => [point.year, point]));
        const complete = points.filter((point) => point.complete && point.value !== null);
        const lastComplete = complete[complete.length - 1];
        const firstComplete = complete[0];
        const change = firstComplete && lastComplete && firstComplete.value ? ((lastComplete.value! - firstComplete.value) / firstComplete.value) * 100 : null;
        return (
          <article key={indicator.code} className="grid gap-2 border-t border-line pt-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="serif text-[14px] tracking-[0.04em] text-ink">{indicator.name}</h3>
              {onOpen ? (
                <button type="button" onClick={() => onOpen(indicator.code)} className="text-[10px] tracking-[0.2em] text-ash hover:text-ink">
                  ABRIR →
                </button>
              ) : null}
            </div>
            <MiniBars years={years} byYear={byYear} />
            <div className="flex items-baseline justify-between text-[11px] tracking-[0.06em] text-ash">
              <span>
                {firstComplete ? `${firstComplete.year}: ${formatNumber(firstComplete.value)}` : "sem ano completo"}
              </span>
              <span className="num text-ink">
                {lastComplete ? `${lastComplete.year}: ${formatNumber(lastComplete.value)}` : ""}
                {change !== null ? <span className="ml-2 text-ash">{formatPercent(change, 0)}</span> : null}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function MiniBars({ years, byYear }: { years: number[]; byYear: Map<number, AnnualPoint> }) {
  const width = 320;
  const height = 64;
  const values = years.map((year) => byYear.get(year)?.value ?? null);
  const max = Math.max(1, ...values.map((value) => value ?? 0));
  const slot = width / years.length;
  const barWidth = Math.max(1.5, slot * 0.68);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" x2={width} y1={height - 0.5} y2={height - 0.5} stroke="var(--line-strong)" strokeWidth="1" />
      {years.map((year, index) => {
        const point = byYear.get(year);
        if (!point || point.value === null) {
          return null;
        }
        const barHeight = Math.max(1, (point.value / max) * (height - 6));
        return (
          <rect
            key={year}
            x={index * slot + (slot - barWidth) / 2}
            y={height - 1 - barHeight}
            width={barWidth}
            height={barHeight}
            fill="var(--ink)"
            fillOpacity={point.complete ? 0.85 : 0.3}
          />
        );
      })}
    </svg>
  );
}
