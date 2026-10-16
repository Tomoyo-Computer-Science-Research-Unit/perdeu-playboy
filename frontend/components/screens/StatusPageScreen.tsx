"use client";

import { StatusScreen } from "@/components/StatusScreen";
import { getDataSources, getSnapshotMeta } from "@/lib/api";

export function StatusPageScreen() {
  const meta = getSnapshotMeta();
  return <StatusScreen generatedAt={meta.generated_at} latest={meta.latest_period} sources={getDataSources()} />;
}
