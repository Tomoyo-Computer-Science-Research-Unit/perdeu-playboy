import type { Metadata } from "next";
import { Panel, Screen } from "@/components/ui";
import { getDataSources, getSnapshotMeta } from "@/lib/api";
import { formatBytes, formatDateTime, formatMonthYear } from "@/lib/format";

export const metadata: Metadata = { title: "Fontes" };

const WORKFLOW_URL = "https://github.com/Tomoyo-Computer-Science-Research-Unit/perdeu-playboy/actions/workflows/update-data.yml";

export default function SourcesPage() {
  const sources = getDataSources();
  const meta = getSnapshotMeta();

  return (
    <Screen columns="minmax(0, 1fr)" rows="minmax(0, 1fr)">
      <Panel
        title={<b>Arquivos oficiais e checksums</b>}
        aside={
          <a href={WORKFLOW_URL} target="_blank" rel="noreferrer" className="btn !h-7 !px-2 text-[10px]">
            Fluxo semanal
          </a>
        }
        flush
        foot={`Snapshot gerado em ${formatDateTime(meta.generated_at)} com dados até ${formatMonthYear(meta.latest_period.year, meta.latest_period.month)}. Tamanho e SHA-256 de cada arquivo, para reproduzir os números.`}
      >
        <table className="ruled">
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
                  {!source.available ? <span className="ml-2 text-[10px] tracking-[0.14em] text-ash">NÃO CARREGADO</span> : null}
                </td>
                <td className="faint">{source.category}</td>
                <td className="font-mono text-[11px]">{source.file_name}</td>
                <td className="num right faint">{formatBytes(source.size_bytes)}</td>
                <td className="font-mono text-[10.5px] text-ash">{source.checksum_sha256 ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </Screen>
  );
}
