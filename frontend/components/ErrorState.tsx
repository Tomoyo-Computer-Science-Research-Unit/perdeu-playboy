export function ErrorState({ message }: { message: string }) {
  return (
    <div className="border border-accent-red bg-surface p-4 text-sm text-foreground shadow-hard">
      {message}
    </div>
  );
}
