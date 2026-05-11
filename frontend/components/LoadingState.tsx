export function LoadingState({ label = "Carregando dados" }: { label?: string }) {
  return (
    <div className="border border-border bg-surface p-6 text-sm text-muted shadow-hard">
      {label}
    </div>
  );
}
