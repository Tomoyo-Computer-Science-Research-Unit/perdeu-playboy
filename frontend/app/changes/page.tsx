import { ChangesExplorer } from "@/components/ChangesExplorer";
import { getLatestChanges } from "@/lib/api";

export default async function ChangesPage() {
  const changes = await getLatestChanges("BR");
  return <ChangesExplorer initialChanges={changes} />;
}
