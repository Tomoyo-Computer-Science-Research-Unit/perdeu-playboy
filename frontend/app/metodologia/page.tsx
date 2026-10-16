import type { Metadata } from "next";
import { MethodologyScreen } from "@/components/screens/MethodologyScreen";

export const metadata: Metadata = { title: "Metodologia" };

export default function MethodologyPage() {
  return <MethodologyScreen />;
}
