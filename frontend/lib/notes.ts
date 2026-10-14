/**
 * Avisos de registro: a série conta registros policiais, não ocorrências. Uma frase por indicador,
 * só onde há um fato datado que muda a leitura. O texto é da UF do build (lib/uf.ts).
 */
import { UF_CONFIG } from "@/lib/uf";

export const INDICATOR_NOTES: Record<string, string> = UF_CONFIG.notes;

export function noteFor(indicator: string | undefined): string | null {
  return indicator ? INDICATOR_NOTES[indicator] ?? null : null;
}
