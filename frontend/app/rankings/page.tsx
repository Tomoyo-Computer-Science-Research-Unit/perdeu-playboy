import { RankingsExplorer } from "@/components/RankingsExplorer";
import { SourceBadge } from "@/components/SourceBadge";
import { getIndicators, getRankings } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function RankingsPage() {
  const [indicators, rows] = await Promise.all([
    getIndicators(),
    getRankings("letalidade_violenta", "count", "municipality", 2026, 3)
  ]);

  return (
    <div className="grid gap-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-l-4 border-border pl-4">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted">Rankings</p>
          <h2 className="mt-1 text-4xl font-display text-foreground m-0 leading-none uppercase">Territórios por indicador</h2>
        </div>
        <SourceBadge />
      </section>

      <RankingsExplorer indicators={indicators} initialRows={rows} />
    </div>
  );
}
