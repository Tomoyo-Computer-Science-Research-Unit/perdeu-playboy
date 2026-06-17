import { TrendsExplorer } from "@/components/TrendsExplorer";
import { ANALYSIS_START_YEAR } from "@/lib/constants";
import { getIndicators, getTerritories, getTimeseries } from "@/lib/api";

export default async function TrendsPage() {
  const [indicators, territories, timeseries] = await Promise.all([
    getIndicators("BR"),
    getTerritories("state", "BR"),
    getTimeseries("roubo_rua", "state", "Brasil", ANALYSIS_START_YEAR, 2026, "BR")
  ]);

  return (
    <div className="grid gap-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-l-4 border-border pl-4">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted">Tendências</p>
          <h2 className="mt-1 text-4xl font-display text-foreground m-0 leading-none uppercase">Séries históricas por indicador</h2>
        </div>
      </section>

      <TrendsExplorer indicators={indicators} initialTerritories={territories} initialData={timeseries} />
    </div>
  );
}
