import type { Metadata } from "next";
import { GovernorsScreen } from "@/components/screens/GovernorsScreen";

export const metadata: Metadata = { title: "Mandatos" };

export default function GovernorsPage() {
  return <GovernorsScreen />;
}
