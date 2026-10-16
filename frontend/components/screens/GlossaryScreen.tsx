"use client";

import { Panel, Screen } from "@/components/ui";
import { getFirstMonth, getIndicators } from "@/lib/api";
import { ufConfig } from "@/lib/uf";

export function GlossaryScreen() {
  const indicators = getIndicators();

  return (
    <Screen columns="minmax(0, 1.2fr) minmax(0, 1fr)">
      <Panel title={<b>Como ler os indicadores</b>} aside={<span>{ufConfig().glossaryAside}</span>}>
        <dl>
          {ufConfig().terms.map((term) => (
            <div key={term.title} className="table-line">
              <dt>{term.title}</dt>
              <dd>{term.body}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel title={<b>Cobertura por indicador</b>} aside={<span>primeiro mês com dado</span>} flush>
        <table className="ruled">
          <thead>
            <tr>
              <th>Indicador</th>
              <th className="right">{ufConfig().stateLabel}</th>
              <th className="right">{ufConfig().policeAreaShort}</th>
              <th className="right">{ufConfig().unitLabel}</th>
              <th>Código</th>
            </tr>
          </thead>
          <tbody>
            {indicators.map((indicator) => (
              <tr key={indicator.code}>
                <td className="text-ink">
                  {indicator.name}
                  <span className="block text-[10px] tracking-[0.06em] text-ash">{indicator.category}</span>
                </td>
                <td className="num right whitespace-nowrap">{getFirstMonth(indicator.code, "state") ?? "–"}</td>
                <td className="num right whitespace-nowrap">{getFirstMonth(indicator.code, "police_area") ?? "–"}</td>
                <td className="num right whitespace-nowrap">{getFirstMonth(indicator.code, "municipality") ?? "–"}</td>
                <td className="font-mono text-[10.5px] text-ash">{indicator.code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </Screen>
  );
}
