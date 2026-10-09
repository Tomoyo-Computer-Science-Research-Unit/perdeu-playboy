import type { Metadata } from "next";
import { RankingsExplorer } from "@/components/RankingsExplorer";

export const metadata: Metadata = { title: "Rankings" };

export default function RankingsPage() {
  return <RankingsExplorer />;
}
