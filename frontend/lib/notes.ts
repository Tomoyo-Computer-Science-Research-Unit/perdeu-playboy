/**
 * Avisos de registro: a série conta registros policiais, não ocorrências. Uma frase por indicador,
 * só onde há um fato datado que muda a leitura.
 */
export const INDICATOR_NOTES: Record<string, string> = {
  estupro:
    "A Lei 12.015, de 7 de agosto de 2009, incorporou ao estupro o antigo atentado violento ao pudor; a série salta em 2009. A disposição de denunciar também mudou no período.",
  feminicidio: "Tipificado pela Lei 13.104, de 9 de março de 2015. O ISP publica a série desde outubro de 2024; antes, esses casos entravam em homicídio doloso.",
  roubo_rua: "Soma de roubo a transeunte, de celular e em coletivo. O roubo de celular é o menos denunciado dos três e a taxa de denúncia variou ao longo da série.",
  morte_interv_policial: "Classificada pela própria polícia. O nome e o critério da categoria mudaram ao longo da série.",
  lesao_corp_morte: "Categoria com dezenas de casos por ano: a reclassificação de poucos registros como homicídio altera o total.",
  letalidade_violenta: "Soma de homicídio doloso, latrocínio, lesão corporal seguida de morte e morte por intervenção de agente do Estado.",
  apreensao_armas: "Mede atividade policial, não crime: mais apreensões podem refletir mais operações."
};

export function noteFor(indicator: string | undefined): string | null {
  return indicator ? INDICATOR_NOTES[indicator] ?? null : null;
}
