import type { Metadata } from "next";
import { ShootingsExplorer } from "@/components/ShootingsExplorer";

export const metadata: Metadata = { title: "Tiroteios" };

export default function ShootingsPage() {
  return <ShootingsExplorer />;
}
