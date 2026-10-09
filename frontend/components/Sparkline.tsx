/** Linha mínima em SVG para históricos anuais; marca mínimo, máximo e último ponto. */
export function Sparkline({
  values,
  width = 160,
  height = 44,
  className = ""
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (values.length < 2) {
    return <svg width={width} height={height} className={className} aria-hidden="true" />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 4;
  const stepX = (width - pad * 2) / (values.length - 1);
  const y = (value: number) => height - pad - ((value - min) / span) * (height - pad * 2);
  const points = values.map((value, index) => `${(pad + index * stepX).toFixed(1)},${y(value).toFixed(1)}`);
  const minIndex = values.indexOf(min);
  const maxIndex = values.indexOf(max);
  const lastIndex = values.length - 1;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true">
      <polyline points={points.join(" ")} fill="none" stroke="var(--ink)" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx={pad + maxIndex * stepX} cy={y(max)} r="2.2" fill="var(--ink)" />
      <circle cx={pad + minIndex * stepX} cy={y(min)} r="2.2" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1" />
      <circle cx={pad + lastIndex * stepX} cy={y(values[lastIndex])} r="2.6" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.4" />
    </svg>
  );
}
