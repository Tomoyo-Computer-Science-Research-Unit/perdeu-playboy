"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { SummaryCardData } from "@/types/api";

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "sem base";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatTimesLower(value: number | null) {
  if (value === null) {
    return "";
  }
  if (value <= 1) {
    return " · igual ao atual";
  }
  return ` · ${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x menor`;
}

export function MetricCard({ card, year }: { card: SummaryCardData; year: number }) {
  const trend = card.yoy_percent_change ?? 0;
  const TrendIcon = trend > 0 ? ArrowUpRight : trend < 0 ? ArrowDownRight : Minus;
  
  const trendColor = trend > 0 ? "text-accent-red" : trend < 0 ? "text-muted" : "text-muted";
  const sparkline = card.sparkline.map((value, index) => ({ index, value }));

  return (
    <article className="border border-border bg-surface p-5 shadow-hard transition-all hover:border-foreground group">
      <div className="flex min-h-16 items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-display uppercase tracking-widest text-foreground transition-colors">{card.name}</h2>
          <p className="mt-1 font-mono text-xs uppercase tracking-wider text-muted">{year}</p>
        </div>
        <span className={`inline-flex items-center gap-1 font-mono text-sm font-bold ${trendColor} bg-background px-2 py-1 border border-border`}>
          <TrendIcon size={16} aria-hidden="true" />
          {formatPercent(card.yoy_percent_change)}
        </span>
      </div>
      <div className="mt-6 grid grid-cols-[1fr_96px] items-end gap-4">
        <div>
          <p className="text-4xl font-display text-foreground m-0 leading-none">{formatNumber(card.current_year_value)}</p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted border-t border-border pt-2">
            Ano anterior: {formatNumber(card.previous_year_same_period)}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted">
            Mínima: {card.historical_min_same_period === null ? "sem base" : formatNumber(card.historical_min_same_period)}
            {card.historical_min_year ? ` (${card.historical_min_year})` : ""}
            {formatTimesLower(card.historical_min_times_lower)}
          </p>
        </div>
        <div className="h-16 border-b-2 border-border opacity-80 mix-blend-screen">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkline}>
              <Line type="step" dataKey="value" stroke="#f2f2f2" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </article>
  );
}
