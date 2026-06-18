import { RankingsExplorer } from "@/components/RankingsExplorer";
import { SourceBadge } from "@/components/SourceBadge";
import { getIndicators, getRankings } from "@/lib/api";

export default async function RankingsPage() {
  const [indicators, municipalityRows, policeAreaRows] = await Promise.all([
    getIndicators("BR"),
    getRankings("crime_geral", "rate", "municipality", 2026, 2, "BR"),
    Promise.resolve([])
  ]);

  return (
    <div className="grid gap-8">
      <section className="flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted">Rankings</p>
          <h2 className="mt-1 text-4xl font-display text-foreground m-0 leading-none uppercase">Territórios por indicador</h2>
        </div>
        <SourceBadge label="ISP / SSP-SP / Sinesp" />
      </section>

      <RankingsExplorer
        indicators={indicators}
        initialMunicipalityRows={municipalityRows}
        initialPoliceAreaRows={policeAreaRows}
      />
    </div>
  );
}
