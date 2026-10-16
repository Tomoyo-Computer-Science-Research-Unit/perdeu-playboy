import type { Metadata } from "next";
import { ChangesScreen } from "@/components/screens/ChangesScreen";

export const metadata: Metadata = { title: "Mudanças" };

export default function ChangesPage() {
  return <ChangesScreen />;
}
