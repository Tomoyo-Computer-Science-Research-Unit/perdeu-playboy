import { ArmedGroupsMapPanel } from "@/components/ArmedGroupsMapPanel";
import { SourceBadge } from "@/components/SourceBadge";

export default async function MapPage() {
  return (
    <div className="grid gap-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-l-4 border-border pl-4">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted">Mapa</p>
          <h2 className="mt-1 text-4xl font-display text-foreground m-0 leading-none uppercase">Controle territorial armado</h2>
        </div>
        <SourceBadge label="GENI/UFF + Fogo Cruzado" />
      </section>

      <ArmedGroupsMapPanel />
    </div>
  );
}
