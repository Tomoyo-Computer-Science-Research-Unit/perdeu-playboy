import { DashboardExplorer } from "@/components/DashboardExplorer";
import { ANALYSIS_START_YEAR } from "@/lib/constants";
import { getLatestPeriod, getSummary, getTerritories, getTerritorialUnits, getTimeseries } from "@/lib/api";

export default async function DashboardPage() {
  const latest = await getLatestPeriod();
  const chartStartYear = Math.max(ANALYSIS_START_YEAR, latest.year - 2);
  const [summary, timeseries, municipalities, territorialUnits] = await Promise.all([
    getSummary(latest.year),
    getTimeseries("letalidade_violenta", "state", "Estado do Rio de Janeiro", chartStartYear, latest.year),
    getTerritories("municipality"),
    getTerritorialUnits("Rio de Janeiro")
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
