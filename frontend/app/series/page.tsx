import type { Metadata } from "next";
import { Suspense } from "react";
import { TrendsExplorer } from "@/components/TrendsExplorer";

export const metadata: Metadata = { title: "Séries históricas" };

export default function TrendsPage() {
  return (
    <Suspense>
      <TrendsExplorer />
    </Suspense>
  );
}
