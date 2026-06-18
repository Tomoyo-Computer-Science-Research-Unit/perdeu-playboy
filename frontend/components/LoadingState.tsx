export function LoadingState({ label = "Carregando dados" }: { label?: string }) {
  return (
    <div className="border border-border bg-surface p-6 font-mono text-xs uppercase tracking-widest text-muted shadow-hard">
      {label}
    </div>
  );
}

export function LoadingOverlay({ label = "Atualizando dados oficiais" }: { label?: string }) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center border border-border bg-background/85 p-6 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="grid w-full max-w-sm gap-4 border border-border bg-surface p-5 text-center shadow-hard">
        <div className="h-1 w-full overflow-hidden bg-border">
          <div className="h-full w-1/2 animate-pulse bg-accent-red" />
        </div>
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">{label}</p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted">Mantendo o recorte anterior até a atualização terminar</p>
      </div>
    </div>
  );
}
