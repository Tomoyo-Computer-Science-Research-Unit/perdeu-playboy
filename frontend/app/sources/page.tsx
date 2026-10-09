import type { Metadata } from "next";
import { PageHeader, Tag } from "@/components/ui";
import { getDataSources, getSnapshotMeta } from "@/lib/api";
import { formatBytes, formatDateTime, formatMonthYear } from "@/lib/format";

export const metadata: Metadata = { title: "Fontes" };

const WORKFLOW_URL = "https://github.com/Tomoyo-Computer-Science-Research-Unit/perdeu-playboy/actions/workflows/update-data.yml";

export default function SourcesPage() {
  const sources = getDataSources();
  const meta = getSnapshotMeta();

  return (
    <div className="grid gap-12">
      <PageHeader
        eyebrow="Fontes"
        title="Arquivos oficiais e checksums"
        lede="Cada arquivo baixado para gerar o snapshot, com tamanho e SHA-256, para que qualquer pessoa reproduza os números."
        aside={<Tag ghost>{formatMonthYear(meta.latest_period.month, meta.latest_period.year)}</Tag>}
      />

      <dl>
        <div className="table-line">
          <dt>Snapshot</dt>
          <dd className="num">{formatDateTime(meta.generated_at)}</dd>
        </div>
        <div className="table-line">
          <dt>Último mês</dt>
          <dd className="num">{formatMonthYear(meta.latest_period.year, meta.latest_period.month)}</dd>
        </div>
        <div className="table-line">
          <dt>Atualização</dt>
          <dd>
            <a href={WORKFLOW_URL} target="_blank" rel="noreferrer" className="underline decoration-fog underline-offset-4 hover:decoration-ink">
              Fluxo semanal no GitHub Actions
            </a>
          </dd>
        </div>
      </dl>

      <div className="overflow-x-auto">
        <table className="ruled min-w-[880px]">
          <thead>
            <tr>
              <th>Fonte</th>
              <th>Categoria</th>
              <th>Arquivo</th>
              <th className="right">Tamanho</th>
              <th>SHA-256</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={`${source.name}-${source.file_name}`}>
                <td>
                  <a href={source.url} target="_blank" rel="noreferrer" className="text-ink underline decoration-fog underline-offset-4 hover:decoration-ink">
                    {source.name}
                  </a>
                  {!source.available ? <p className="text-[10px] tracking-[0.14em] text-ash">NÃO CARREGADO</p> : null}
                </td>
                <td className="faint">{source.category}</td>
                <td className="font-mono text-[12px]">{source.file_name}</td>
                <td className="num right faint">{formatBytes(source.size_bytes)}</td>
                <td className="max-w-[300px] break-all font-mono text-[11px] leading-5 text-ash">{source.checksum_sha256 ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
