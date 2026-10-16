import type { Metadata } from "next";
import { ShootingsExplorer } from "@/components/ShootingsExplorer";

export const metadata: Metadata = { title: "Tiroteios" };

// Tiroteios só existe onde há fonte (Fogo Cruzado, no Rio): a rota fica só na raiz, fora de /[uf]/.
export default function ShootingsPage() {
  return <ShootingsExplorer />;
}
