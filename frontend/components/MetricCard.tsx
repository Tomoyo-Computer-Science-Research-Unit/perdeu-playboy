import { Sparkline } from "@/components/Sparkline";
import { deltaGlyph, formatNumber, formatPercent, formatPeriodRange, formatRate } from "@/lib/format";
import type { SummaryCardData } from "@/types/api";

export function MetricCard({ card, onOpen }: { card: SummaryCardData; onOpen?: (indicator: string) => void }) {
  const history = card.annual_history.map((point) => point.value);
  const firstHistoryYear = card.annual_history[0]?.year;
  const lastHistoryYear = card.annual_history[card.annual_history.length - 1]?.year;
  const periodLabel = formatPeriodRange(card.year, card.latest_month);
  const previousLabel = formatPeriodRange(card.year - 1, card.latest_month);
  const unit = card.unit === "armas" ? "armas" : "ocorrências";

  return (
    <article className="group grid content-start gap-4 border-t border-line-strong pt-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow text-[9.5px]">{card.category}</p>
          <h3 className="serif mt-1 text-[17px] leading-snug tracking-[0.04em] text-ink">{card.name}</h3>
        </div>
        {onOpen ? (
          <button
            type="button"
            onClick={() => onOpen(card.indicator)}
            className="shrink-0 text-[10px] tracking-[0.2em] text-ash transition-colors hover:text-ink"
            aria-label={`Ver série de ${card.name}`}
          >
            SÉRIE →
          </button>
        ) : null}
      </header>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="num display text-[34px] leading-none text-ink">{formatNumber(card.current_year_value)}</p>
          <p className="mt-2 text-[11px] tracking-[0.1em] text-ash">
            {unit} · {periodLabel}
          </p>
        </div>
        <div className="text-right">
          <p className="num text-[15px] text-ink">
            <span aria-hidden="true" className="mr-1 text-[11px]">
              {deltaGlyph(card.yoy_percent_change)}
            </span>
            {card.yoy_percent_change === null ? "sem base" : formatPercent(card.yoy_percent_change)}
          </p>
          <p className="mt-1 text-[11px] tracking-[0.06em] text-ash">
            {card.previous_year_same_period === null ? "série nova" : `${formatNumber(card.previous_year_same_period)} em ${previousLabel}`}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line pt-3 text-[11.5px] leading-6">
        <dt className="text-ash">Mínimo no período</dt>
        <dd className="num text-right text-ink">
          {card.historical_min ? (
            <>
              {formatNumber(card.historical_min.value)} <span className="text-ash">({card.historical_min.year})</span>
            </>
          ) : (
            "–"
          )}
        </dd>
        <dt className="text-ash">Máximo no período</dt>
        <dd className="num text-right text-ink">
          {card.historical_max ? (
            <>
              {formatNumber(card.historical_max.value)} <span className="text-ash">({card.historical_max.year})</span>
            </>
          ) : (
            "–"
          )}
        </dd>
        {card.rate_per_100k !== null ? (
          <>
            <dt className="text-ash">Por 100 mil hab.</dt>
            <dd className="num text-right text-ink">{formatRate(card.rate_per_100k)}</dd>
          </>
        ) : null}
      </dl>

      {history.length >= 2 ? (
        <div className="flex items-end justify-between gap-3 border-t border-line pt-3">
          <div className="text-[10px] tracking-[0.14em] text-ash">
            <span>{firstHistoryYear}</span>
            <span className="mx-1">→</span>
            <span>{lastHistoryYear}</span>
            <span className="ml-2">totais anuais</span>
          </div>
          <Sparkline values={history} width={150} height={40} className="shrink-0" />
        </div>
      ) : (
        <p className="border-t border-line pt-3 text-[10px] tracking-[0.14em] text-ash">Série iniciada em {card.first_year}</p>
      )}
    </article>
  );
}
