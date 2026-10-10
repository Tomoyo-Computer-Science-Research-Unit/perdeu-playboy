"use client";

import { useMemo } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/lib/format";
import type { GovernorTerm } from "@/types/api";

export type ChartPoint = {
  /** Chave única no eixo X ("1998" ou "1998-03"). */
  key: string;
  label: string;
  value: number | null;
  secondary?: number | null;
  /** Ano incompleto (até o último mês publicado). */
  partial?: boolean;
  note?: string;
};

type Props = {
  points: ChartPoint[];
  kind: "annual" | "monthly";
  valueLabel: string;
  secondaryLabel?: string;
  digits?: number;
  terms?: GovernorTerm[];
  /** Prefeitos: limites tracejados e rótulos numa segunda linha, abaixo dos governadores. */
  mayors?: GovernorTerm[];
  showTerms?: boolean;
  /** Altura fixa em px; sem ela o gráfico preenche o pai (que precisa ter altura definida). */
  height?: number;
};

/**
 * Gráfico histórico em preto e branco. Barras para totais anuais, linha para séries mensais,
 * com faixas alternadas marcando os mandatos de governador.
 */
export function HistoryChart({ points, kind, valueLabel, secondaryLabel, digits = 0, terms = [], mayors = [], showTerms = true, height }: Props) {
  const bands = useMemo(() => (showTerms ? termBands(terms, points) : []), [points, showTerms, terms]);
  const mayorBands = useMemo(() => (showTerms ? termBands(mayors, points) : []), [mayors, points, showTerms]);
  const ticks = useMemo(() => xTicks(points, kind), [kind, points]);
  const hasData = points.some((point) => point.value !== null);

  if (!hasData) {
    return (
      <div className="chart-fill grid place-items-center text-[11px] tracking-[0.18em] text-ash" style={{ height }}>
        SEM DADOS PARA ESTE RECORTE
      </div>
    );
  }

  return (
    <div className="chart chart-fill" style={height ? { height, flex: "none" } : undefined}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 12, right: 10, left: 0, bottom: 0 }} barCategoryGap={kind === "annual" ? "28%" : "5%"}>
          <CartesianGrid vertical={false} strokeDasharray="2 4" />
          {bands.map((band, index) => (
            <ReferenceArea
              key={`${band.governor}-${band.x1}`}
              x1={band.x1}
              x2={band.x2}
              ifOverflow="hidden"
              fillOpacity={index % 2 === 0 ? 0.045 : 0}
              stroke="var(--line)"
              strokeOpacity={1}
              label={
                band.x1 === band.x2
                  ? undefined
                  : // Mandatos curtos encostam uns nos outros: alterna a linha do rótulo para não sobrepor.
                    { value: band.short, position: "insideTopLeft", fill: "var(--ash)", fontSize: 10, letterSpacing: "0.12em", offset: index % 2 === 0 ? 6 : 20 }
              }
            />
          ))}
          {mayorBands.map((band, index) => (
            <ReferenceArea
              key={`mayor-${band.governor}-${band.x1}`}
              x1={band.x1}
              x2={band.x2}
              ifOverflow="hidden"
              fillOpacity={0}
              stroke="var(--line-strong)"
              strokeDasharray="2 3"
              strokeOpacity={1}
              label={
                band.x1 === band.x2
                  ? undefined
                  : // Segunda e terceira linhas do topo, abaixo dos governadores, onde não há barras.
                    { value: `pref. ${band.short}`, position: "insideTopLeft", fill: "var(--ash)", fontSize: 10, letterSpacing: "0.12em", offset: index % 2 === 0 ? 24 : 38 }
              }
            />
          ))}
          <XAxis dataKey="key" ticks={ticks} tickFormatter={(key: string) => key.slice(0, 4)} interval={0} tickMargin={8} minTickGap={12} />
          <YAxis
            width={50}
            // Folga no topo para os rótulos de mandato não caírem sobre as barras mais altas.
            domain={[0, (dataMax: number) => Math.ceil(dataMax * (mayorBands.length ? 1.22 : 1.1))]}
            tickFormatter={(value: number) => formatNumber(value, digits)}
            tickMargin={6}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--line)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) {
                return null;
              }
              const point = payload[0].payload as ChartPoint;
              return (
                <div className="chart-tooltip">
                  <strong>{point.label}</strong>
                  <div className="row">
                    <span>{valueLabel}</span>
                    <span>{formatNumber(point.value, digits)}</span>
                  </div>
                  {secondaryLabel && point.secondary !== undefined ? (
                    <div className="row">
                      <span>{secondaryLabel}</span>
                      <span>{formatNumber(point.secondary, digits)}</span>
                    </div>
                  ) : null}
                  {point.note ? <div className="mt-1 text-[11px] text-ash">{point.note}</div> : null}
                </div>
              );
            }}
          />
          {kind === "annual" ? (
            <Bar dataKey="value" name={valueLabel} isAnimationActive={false} maxBarSize={48}>
              {points.map((point) => (
                <Cell key={point.key} fill="var(--ink)" fillOpacity={point.partial ? 0.35 : 0.92} stroke={point.partial ? "var(--ink)" : "none"} strokeDasharray={point.partial ? "3 3" : undefined} />
              ))}
            </Bar>
          ) : (
            <Line type="monotone" dataKey="value" name={valueLabel} stroke="var(--ink)" strokeWidth={1.4} dot={false} connectNulls={false} isAnimationActive={false} />
          )}
          {secondaryLabel ? (
            <Line
              type="monotone"
              dataKey="secondary"
              name={secondaryLabel}
              stroke="var(--ash)"
              strokeWidth={kind === "annual" ? 1.4 : 2.2}
              strokeDasharray={kind === "annual" ? "4 4" : undefined}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function xTicks(points: ChartPoint[], kind: "annual" | "monthly"): string[] {
  const years = Array.from(new Set(points.map((point) => point.key.slice(0, 4))));
  const step = years.length > 28 ? 5 : years.length > 14 ? 2 : 1;
  const keep = new Set(years.filter((_, index) => index % step === 0));
  if (kind === "annual") {
    return points.filter((point) => keep.has(point.key)).map((point) => point.key);
  }
  return points.filter((point) => point.key.endsWith("-01") && keep.has(point.key.slice(0, 4))).map((point) => point.key);
}

function termBands(terms: GovernorTerm[], points: ChartPoint[]) {
  if (points.length === 0) {
    return [];
  }
  const keys = points.map((point) => point.key);
  const first = keys[0];
  const last = keys[keys.length - 1];
  const annual = first.length === 4;
  return terms
    .map((term) => {
      const start = annual ? term.term_start.slice(0, 4) : term.term_start.slice(0, 7);
      const end = term.term_end ? (annual ? term.term_end.slice(0, 4) : term.term_end.slice(0, 7)) : last;
      const x1 = keys.find((key) => key >= start) ?? null;
      const x2 = [...keys].reverse().find((key) => key <= end) ?? null;
      if (!x1 || !x2 || x1 > x2) {
        return null;
      }
      return { governor: term.governor, short: shortName(term.governor), x1, x2 };
    })
    .filter((band): band is { governor: string; short: string; x1: string; x2: string } => band !== null)
    .filter((band) => band.x2 >= first && band.x1 <= last);
}

function shortName(governor: string): string {
  const parts = governor.split(" ");
  const last = parts[parts.length - 1];
  // "Rosinha" e "Anthony Garotinho" dividem o sobrenome, e "Silva" diz pouco: usa o primeiro nome.
  if (["Garotinho", "Silva", "Maia", "Conde"].includes(last)) {
    return parts[0] === "Luiz" ? "Conde" : parts[0];
  }
  return last;
}
