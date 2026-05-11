export function TerritoryFilter() {
  return (
    <div className="grid gap-4 min-w-0 md:grid-cols-[180px_1fr]">
      <label className="grid gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted min-w-0">
        Tipo
        <select className="h-10 w-full min-w-0 border border-border bg-surface px-3 text-sm text-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-colors" defaultValue="state">
          <option value="state">ESTADO</option>
          <option value="municipality">MUNICÍPIO</option>
          <option value="police_area">ÁREA POLICIAL</option>
        </select>
      </label>
      <label className="grid gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted min-w-0">
        Território
        <input className="h-10 w-full min-w-0 border border-border bg-surface px-3 text-sm text-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-colors placeholder:text-muted/50" placeholder="ESTADO DO RIO DE JANEIRO" />
      </label>
    </div>
  );
}
