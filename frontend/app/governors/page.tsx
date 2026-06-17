import { GovernorsExplorer } from "@/components/GovernorsExplorer";
import { getGovernorPerformance } from "@/lib/api";

export default async function GovernorsPage() {
  const performance = await getGovernorPerformance("BR");
  return <GovernorsExplorer initialPerformance={performance} />;
}
