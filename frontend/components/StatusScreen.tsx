"use client";

import { useEffect, useState } from "react";
import { UF_CONFIG } from "@/lib/uf";
import { EmptyState, Panel, Screen, Stat } from "@/components/ui";
import { formatBytes, formatDateTime, formatMonthYear } from "@/lib/format";
import type { DataSource, LatestPeriod } from "@/types/api";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type Run = { at: string; result: string; detail?: string | null; key?: string | null; duration_s?: number };
type Remote = { status: number | null; last_modified?: string | null; size_bytes?: number | null; error?: string };
type CheckFile = { file_name: string; rows: number; latest_month: string | null; lag_months: number | null; problems: string[]; warnings: string[]; ok: boolean };
/** Forma do status.json; o `public/status.json` do repositório é um placeholder vazio com os mesmos campos. */
type Status = {
  written_at: string | null;
  snapshot: { generated_at: string; latest_period: LatestPeriod } | null;
  last_run: Run | null;
  last_published: Run | null;
  runs: Run[];
  check: { checked_at: string; ok: boolean; files: CheckFile[] } | null;
  sources: Array<DataSource & { remote?: Remote }>;
};

/** Última checagem, último build e o estado de cada arquivo oficial; lê o status.json escrito pelo servidor. */
export function StatusScreen({ generatedAt, latest, sources }: { generatedAt: string; latest: LatestPeriod; sources: DataSource[] }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${BASE_PATH}/status.json`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data: Status) => {
        if (alive) {
          setStatus(data);
        }
      })
      .catch(() => {
        if (alive) {
          setUnavailable(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const files = (status?.sources.length ? status.sources : sources).filter((source) => /\.csv(\.gz)?$/.test(source.file_name));
  const checks = new Map((status?.check?.files ?? []).map((file) => [file.file_name, file]));
  const period = status?.snapshot?.latest_period ?? latest;
  const lastRun = status?.last_run ?? null;
  const published = status?.last_published ?? null;
  const lag = monthsSince(period);

  return (
    <Screen columns="minmax(0, 1fr) 360px" rows="auto minmax(0, 1fr)">
      <Panel title={<b>Atualização</b>}>
        <div className="grid grid-cols-4 gap-x-6">
          <Stat label="Última checagem" value={lastRun ? formatDateTime(lastRun.at) : "–"} sub={lastRun ? resultLabel(lastRun) : unavailable ? "status indisponível" : undefined} />
          <Stat label="Último build" value={published ? formatDateTime(published.at) : formatDateTime(generatedAt)} sub={published?.key ? `commit ${published.key.split(" ")[0]}` : undefined} />
          <Stat label="Dados até" value={formatMonthYear(period.year, period.month)} sub={lag === 0 ? "mês corrente" : `há ${lag} ${lag === 1 ? "mês" : "meses"}`} />
          <Stat label="Próxima checagem" value="06:23" sub="todo dia, horário de Brasília" />
        </div>
      </Panel>

      <Panel title={<b>Rodadas</b>} flush fill style={{ gridRow: "1 / span 2" }}>
        {status && status.runs.length > 0 ? (
          <table className="ruled">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Resultado</th>
                <th className="right">Duração</th>
              </tr>
            </thead>
            <tbody>
              {status.runs.map((run) => (
                <tr key={run.at}>
                  <td className="num">{formatDateTime(run.at)}</td>
                  <td className={run.result === "publicado" ? "" : run.result === "sem mudança" ? "faint" : "worse"}>{resultLabel(run)}</td>
                  <td className="num right faint">{run.duration_s !== undefined ? `${run.duration_s} s` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState>{unavailable ? "STATUS.JSON INDISPONÍVEL" : "SEM RODADAS REGISTRADAS"}</EmptyState>
        )}
      </Panel>

      <Panel title={<b>{UF_CONFIG.statusFilesTitle}</b>} flush fill>
        <table className="ruled">
          <thead>
            <tr>
              <th>Arquivo</th>
              <th>Último mês</th>
              <th>{UF_CONFIG.statusModifiedLabel}</th>
              <th className="right">Tamanho</th>
              <th>SHA-256</th>
              <th>Contrato</th>
            </tr>
          </thead>
          <tbody>
            {files.map((source) => {
              const check = checks.get(source.file_name);
              const remote: Remote | undefined = (source as DataSource & { remote?: Remote }).remote;
              return (
                <tr key={source.file_name}>
                  <td className="font-mono text-[11px]">
                    <a href={source.url} target="_blank" rel="noreferrer" className="text-ink underline decoration-fog underline-offset-4 hover:decoration-ink">
                      {source.file_name}
                    </a>
                  </td>
                  <td className="num">{check?.latest_month ? monthLabel(check.latest_month) : "–"}</td>
                  <td className="num">{remote?.last_modified ? formatDateTime(new Date(remote.last_modified).toISOString()) : remote?.error ? "sem resposta" : "–"}</td>
                  <td className="num right faint">{formatBytes(remote?.size_bytes ?? source.size_bytes)}</td>
                  <td className="font-mono text-[10.5px] text-ash">{source.checksum_sha256 ? source.checksum_sha256.slice(0, 16) : "–"}</td>
                  <td>
                    {check ? (
                      check.ok ? (
                        <span className={check.warnings.length ? "" : "better"}>{check.warnings.length ? check.warnings[0] : "ok"}</span>
                      ) : (
                        <span className="worse">{check.problems.join("; ")}</span>
                      )
                    ) : (
                      <span className="faint">–</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </Screen>
  );
}

function resultLabel(run: Run): string {
  return run.detail ? `${run.result} (${run.detail})` : run.result;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return formatMonthYear(year, month);
}

function monthsSince(period: LatestPeriod): number {
  const now = new Date();
  return Math.max(0, (now.getFullYear() - period.year) * 12 + (now.getMonth() + 1 - period.month));
}
