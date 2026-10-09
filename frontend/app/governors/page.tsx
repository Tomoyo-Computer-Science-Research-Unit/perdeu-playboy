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
        title={
          <>
            <b>Governadores do Rio</b> · média mensal no mandato vs os 12 meses anteriores à posse
          </>
        }
        aside={<span>{performance.indicators.length} indicadores</span>}
        flush
        foot={`${performance.methodology} Comparação descritiva, não atribuição de causa.`}
      >
        <GovernorsPerformanceTable rows={performance.rows} />
      </Panel>
    </Screen>
  );
}
