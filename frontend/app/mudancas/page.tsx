import type { Metadata } from "next";
import { ChangesExplorer } from "@/components/ChangesExplorer";
import { getLatestChanges } from "@/lib/api";

export const metadata: Metadata = { title: "Mudanças" };

export default async function ChangesPage() {
  const changes = await getLatestChanges();
  return <ChangesExplorer sections={changes.sections} latest={changes.latest_period} />;
}
