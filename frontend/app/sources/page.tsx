import { ExternalLink } from "lucide-react";
import { CoverageNotice } from "@/components/CoverageNotice";
import { MethodologyDrawer } from "@/components/MethodologyDrawer";
import { getDataSources, getSnapshotMeta } from "@/lib/api";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}

function formatBytes(value: number | null) {
  if (value === null) {
    return "-";
  }
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value / 1024 / 1024) + " MB";
}

export default async function SourcesPage() {
  const [rjSources, spSources, snapshot] = await Promise.all([getDataSources("RJ"), getDataSources("SP"), getSnapshotMeta()]);
  const sources = [
    ...rjSources.map((source) => ({ ...source, name: `RJ · ${source.name}` })),
    ...spSources.map((source) => ({ ...source, name: `SP · ${source.name}` }))
  ];

  return (
    <div className="grid gap-8">
      <section className="border-l-4 border-border pl-4">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted">Fontes</p>
        <h2 className="m-0 mt-1 text-4xl font-display uppercase leading-none text-foreground">Dados e checksums</h2>
      </section>

      <section className="grid gap-4 border border-border bg-surface p-5 shadow-hard md:grid-cols-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Última atualização</p>
          <p className="mt-2 font-mono text-sm font-bold text-foreground">{formatDate(snapshot.generated_at)}</p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Período mais recente</p>
          <p className="mt-2 font-mono text-sm font-bold text-foreground">
            {String(snapshot.latest_period.month).padStart(2, "0")}/{snapshot.latest_period.year}
          </p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Workflow</p>
          <a
            href="https://github.com/c3c4d4/perdeu-playboy/actions/workflows/update-data.yml"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-2 font-mono text-sm font-bold text-foreground underline decoration-border underline-offset-4 hover:text-accent-red"
          >
            GitHub Actions <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      </section>

      <CoverageNotice>
        O snapshot é estático e versionado no repositório. A atualização automática roda semanalmente quando o workflow do GitHub Actions está habilitado e também pode ser acionada manualmente.
      </CoverageNotice>

      <section className="overflow-x-auto border border-border bg-surface shadow-hard">
        <table className="min-w-[920px] divide-y divide-border text-sm">
          <thead className="bg-background text-left font-mono text-xs font-bold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Fonte</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Arquivo</th>
              <th className="px-4 py-3 text-right">Tamanho</th>
              <th className="px-4 py-3">SHA-256</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sources.map((source) => (
              <tr key={`${source.name}-${source.file_name}`} className="align-top hover:bg-background/50">
                <td className="px-4 py-3">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-foreground hover:text-muted"
                  >
                    {source.name}
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                  {!source.available ? <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-accent-red">não carregado no snapshot</p> : null}
                </td>
                <td className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">{source.category}</td>
                <td className="px-4 py-3 font-mono text-xs text-foreground">{source.file_name}</td>
                <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-muted">{formatBytes(source.size_bytes)}</td>
                <td className="max-w-[320px] break-all px-4 py-3 font-mono text-[11px] leading-5 text-muted">{source.checksum_sha256 ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <MethodologyDrawer
        csvs={sources.map((source) => source.file_name)}
        columns={["checksum_sha256", "size_bytes", "generated_at", "latest_period"]}
        period={`Snapshot gerado em ${formatDate(snapshot.generated_at)}`}
        formula="Cada arquivo local carregado recebe SHA-256 e tamanho; o frontend publica o snapshot estático gerado pela ETL."
        limits={["O ISP pode revisar arquivos históricos.", "Arquivos indisponíveis não entram no snapshot.", "A data de geração não é necessariamente a data de publicação do ISP."]}
      />
    </div>
  );
}
