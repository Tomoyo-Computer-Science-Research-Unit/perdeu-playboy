"use client";

import { GovernorsPerformanceTable } from "@/components/GovernorsPerformanceTable";
import { Panel, Screen } from "@/components/ui";
import { getGovernorPerformance } from "@/lib/api";
import { ufConfig } from "@/lib/uf";

export function GovernorsScreen() {
  const performance = getGovernorPerformance();
  return (
    <Screen columns="minmax(0, 1fr)" rows="minmax(0, 1fr)">
      <Panel
        title={<b>{ufConfig().governorsTitle}</b>}
        aside={<span>média mensal no mandato vs 12 meses antes da posse · {performance.indicators.length} indicadores</span>}
        flush
      >
        <GovernorsPerformanceTable rows={performance.rows} />
      </Panel>
    </Screen>
  );
}
