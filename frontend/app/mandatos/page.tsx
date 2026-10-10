import type { Metadata } from "next";
import { GovernorsPerformanceTable } from "@/components/GovernorsPerformanceTable";
import { Panel, Screen } from "@/components/ui";
import { getGovernorPerformance } from "@/lib/api";

export const metadata: Metadata = { title: "Mandatos" };

export default function GovernorsPage() {
  const performance = getGovernorPerformance();
  return (
    <Screen columns="minmax(0, 1fr)" rows="minmax(0, 1fr)">
      <Panel
        title={<b>Governadores do Rio</b>}
        aside={<span>média mensal no mandato vs 12 meses antes da posse · {performance.indicators.length} indicadores</span>}
        flush
      >
        <GovernorsPerformanceTable rows={performance.rows} />
      </Panel>
    </Screen>
  );
}
