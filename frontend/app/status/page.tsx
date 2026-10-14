import type { Metadata } from "next";
import { StatusScreen } from "@/components/StatusScreen";
import { getDataSources, getSnapshotMeta } from "@/lib/api";

export const metadata: Metadata = { title: "Status" };

export default function StatusPage() {
  const meta = getSnapshotMeta();
  return <StatusScreen generatedAt={meta.generated_at} latest={meta.latest_period} sources={getDataSources()} />;
}
