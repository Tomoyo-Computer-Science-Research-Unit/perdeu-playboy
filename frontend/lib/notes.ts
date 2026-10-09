/**
 * Avisos de notificação: parte do que sobe ou desce numa série é registro, não crime. Uma frase
 * por indicador, só onde há motivo concreto e documentado.
 */
export const INDICATOR_NOTES: Record<string, string> = {
  estupro:
    "Em 2009 a lei juntou o antigo atentado violento ao pudor ao estupro e a série salta ali. Aumentos recentes também refletem mais denúncia, não só mais crime.",
  feminicidio:
    "Tipificado em 2015 e publicado pelo ISP só desde outubro de 2024. Antes disso os casos entravam em homicídio doloso.",
  roubo_rua: "Agregado do ISP: transeunte, celular e coletivo. Roubo de celular é pouco denunciado e a denúncia variou com o tempo.",
  morte_interv_policial: "Registro feito pela própria polícia. O nome da categoria mudou ao longo dos anos e o critério de classificação também.",
  lesao_corp_morte: "Categoria pequena e sensível à classificação: um caso reclassificado como homicídio muda o ano.",
  letalidade_violenta: "Soma de homicídio doloso, latrocínio, lesão seguida de morte e morte por intervenção de agente do Estado. A composição depende de como cada morte é classificada.",
  apreensao_armas: "Mede atividade policial, não crime: mais apreensões podem significar mais operações, não mais armas."
};

export function noteFor(indicator: string | undefined): string | null {
  return indicator ? INDICATOR_NOTES[indicator] ?? null : null;
}
