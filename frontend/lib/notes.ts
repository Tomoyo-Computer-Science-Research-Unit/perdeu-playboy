/**
 * Avisos de registro: a série conta registros policiais, não ocorrências. Uma frase por indicador,
 * só onde há um fato datado que muda a leitura. O texto é da UF da tela (lib/uf.ts).
 */
import { ufConfig } from "@/lib/uf";

export function noteFor(indicator: string | undefined): string | null {
  return indicator ? ufConfig().notes[indicator] ?? null : null;
}
