"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TimeSeriesPoint } from "@/types/api";

function formatChartValue(value: number | string) {
  if (typeof value !== "number") {
    return value;
  }
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}

function formatYearTick(value: string) {
  const yearSuffix = Number(value.slice(3));
  if (Number.isNaN(yearSuffix)) {
    return value;
  }
  return String(yearSuffix >= 80 ? 1900 + yearSuffix : 2000 + yearSuffix);
}

export function TrendChart({ data }: { data: TimeSeriesPoint[] }) {
  const chartData = data.map((point) => ({
    period: `${String(point.month).padStart(2, "0")}/${String(point.year).slice(2)}`,
    year: point.year,
    month: point.month,
    value: point.value,
    moving_average: point.moving_average,
    previous_year_value: point.previous_year_value
  }));
  const years = Array.from(new Set(data.map((point) => point.year))).sort((a, b) => a - b);
  const yearStep = years.length > 25 ? 5 : years.length > 12 ? 2 : 1;
  const visibleYearTicks = new Set(years.filter((year, index) => index % yearStep === 0 || index === years.length - 1));
  const ticks = chartData
    .filter((point) => point.month === 1 && visibleYearTicks.has(point.year))
    .map((point) => point.period);

  return (
    <div className="h-[400px] border border-border bg-surface p-4 shadow-hard">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#303030" vertical={false} />
          <XAxis
            dataKey="period"
            ticks={ticks}
            tickFormatter={formatYearTick}
            tick={{ fill: "#9a9a9a", fontSize: 12, fontFamily: "var(--font-roboto-mono)" }}
            tickLine={{ stroke: "#303030" }}
            axisLine={{ stroke: "#303030" }}
            interval={0}
          />
          <YAxis tick={{ fill: "#9a9a9a", fontSize: 12, fontFamily: "var(--font-roboto-mono)" }} width={52} tickLine={{ stroke: "#303030" }} axisLine={{ stroke: "#303030" }} />
          <Tooltip 
            contentStyle={{ backgroundColor: "#050505", border: "1px solid #303030", borderRadius: 0, fontFamily: "var(--font-roboto-mono)", fontSize: "12px", color: "#f2f2f2" }} 
            itemStyle={{ color: "#f2f2f2" }}
            formatter={formatChartValue}
          />
          <Legend wrapperStyle={{ fontFamily: "var(--font-roboto-mono)", fontSize: "12px", textTransform: "uppercase" }} />
          <Line name="Valor mensal" type="step" dataKey="value" stroke="#f2f2f2" strokeWidth={2} dot={false} />
          <Line name="Média móvel" type="monotone" dataKey="moving_average" stroke="#a6a6a6" strokeWidth={3} dot={false} />
          <Line name="Ano anterior" type="step" dataKey="previous_year_value" stroke="#6f6f6f" strokeWidth={1} strokeDasharray="4 4" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
