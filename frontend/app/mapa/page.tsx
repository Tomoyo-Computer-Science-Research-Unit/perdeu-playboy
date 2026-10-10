import type { Metadata } from "next";
import { Suspense } from "react";
import { MunicipalityChoroplethPanel } from "@/components/MunicipalityChoroplethPanel";

export const metadata: Metadata = { title: "Mapa" };

export default function MapPage() {
  return (
    <Suspense>
      <MunicipalityChoroplethPanel />
    </Suspense>
  );
}
