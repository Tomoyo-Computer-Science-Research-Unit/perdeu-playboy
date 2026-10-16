import type { Metadata } from "next";
import { SourcesScreen } from "@/components/screens/SourcesScreen";

export const metadata: Metadata = { title: "Fontes" };

export default function SourcesPage() {
  return <SourcesScreen />;
}
