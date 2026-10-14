import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShootingsExplorer } from "@/components/ShootingsExplorer";
import { UF_CONFIG } from "@/lib/uf";

export const metadata: Metadata = { title: "Tiroteios" };

// Tiroteios só existe onde há fonte (Fogo Cruzado, no Rio); nas outras UFs a rota não é gerada.
export default function ShootingsPage() {
  if (!UF_CONFIG.hasShootings) {
    notFound();
  }
  return <ShootingsExplorer />;
}
