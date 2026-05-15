interface MethodologyDrawerProps {
  title?: string;
  csvs: string[];
  columns: string[];
  period: string;
  formula: string;
  limits: string[];
}

export function MethodologyDrawer({
  title = "Fonte e cálculo",
  csvs,
  columns,
  period,
  formula,
  limits
}: MethodologyDrawerProps) {
  return (
    <details className="border border-border bg-surface p-4 font-mono text-xs uppercase leading-5 tracking-wide text-muted shadow-hard">
      <summary className="cursor-pointer font-bold text-foreground">{title}</summary>
      <div className="mt-4 grid gap-3">
        <p>
          <span className="text-foreground">CSVs:</span> {csvs.join(" / ")}
        </p>
        <p>
          <span className="text-foreground">Colunas:</span> {columns.join(" / ")}
        </p>
        <p>
          <span className="text-foreground">Período:</span> {period}
        </p>
        <p>
          <span className="text-foreground">Fórmula:</span> {formula}
        </p>
        <ul className="grid gap-1">
          {limits.map((limit) => (
            <li key={limit}>- {limit}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}
