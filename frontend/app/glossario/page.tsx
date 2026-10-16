import type { Metadata } from "next";
import { GlossaryScreen } from "@/components/screens/GlossaryScreen";

export const metadata: Metadata = { title: "Glossário" };

export default function GlossaryPage() {
  return <GlossaryScreen />;
}
