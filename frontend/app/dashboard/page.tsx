import { DashboardExplorer } from "@/components/DashboardExplorer";
import { ANALYSIS_START_YEAR } from "@/lib/constants";
import { getLatestPeriod, getSummary, getTerritories, getTerritorialUnits, getTimeseries } from "@/lib/api";

export default async function DashboardPage() {
  const latest = await getLatestPeriod("BR");
  const chartStartYear = Math.max(ANALYSIS_START_YEAR, latest.year - 2);
  const [summary, timeseries, municipalities, territorialUnits] = await Promise.all([
    getSummary(latest.year, "state", "Brasil", "BR"),
    getTimeseries("letalidade_violenta", "state", "Brasil", chartStartYear, latest.year, "BR"),
    getTerritories("municipality", "BR"),
    getTerritorialUnits("Rio de Janeiro", "BR")
  ]);

  return (
    <DashboardExplorer
      latestYear={latest.year}
      initialSummary={summary}
      initialTimeseries={timeseries}
      municipalities={municipalities}
      initialTerritorialUnits={territorialUnits}
    />
  );
}
