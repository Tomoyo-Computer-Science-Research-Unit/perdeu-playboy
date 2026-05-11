import { Database } from "lucide-react";

export function SourceBadge({ label = "ISP Dados Abertos" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 border border-border bg-background px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-widest text-muted">
      <Database size={14} aria-hidden="true" className="text-muted" />
      {label}
    </span>
  );
}
