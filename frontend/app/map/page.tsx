import { MunicipalityChoroplethPanel } from "@/components/MunicipalityChoroplethPanel";
import { SourceBadge } from "@/components/SourceBadge";
import { getCrimeRateMapData, getLatestPeriod, getMapIndicators } from "@/lib/api";

export default async function MapPage() {
  const [indicators, latest] = await Promise.all([getMapIndicators(), getLatestPeriod()]);
  const mapData = await getCrimeRateMapData(latest.year, latest.month);

  return (
    <div className="grid gap-8">
      <section className="flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted">Mapa</p>
          <h2 className="mt-1 text-4xl font-display text-foreground m-0 leading-none uppercase">Municípios do estado</h2>
        </div>
        <SourceBadge label="ISP / SSP-SP / Sinesp + IBGE" />
      </section>

      <MunicipalityChoroplethPanel
        indicators={indicators}
        initialData={mapData}
        latestYear={latest.year}
        latestMonth={latest.month}
      />
    </div>
  );
}
