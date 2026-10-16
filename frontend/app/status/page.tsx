import type { Metadata } from "next";
import { StatusPageScreen } from "@/components/screens/StatusPageScreen";

export const metadata: Metadata = { title: "Status" };

export default function StatusPage() {
  return <StatusPageScreen />;
}
