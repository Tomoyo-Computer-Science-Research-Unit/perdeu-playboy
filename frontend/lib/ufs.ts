export type UfCode =
  | "AC"
  | "AL"
  | "AP"
  | "AM"
  | "BA"
  | "CE"
  | "DF"
  | "ES"
  | "GO"
  | "MA"
  | "MT"
  | "MS"
  | "MG"
  | "PA"
  | "PB"
  | "PR"
  | "PE"
  | "PI"
  | "RJ"
  | "RN"
  | "RS"
  | "RO"
  | "RR"
  | "SC"
  | "SP"
  | "SE"
  | "TO";

export type UfOption = {
  code: UfCode;
  name: string;
  enabled: boolean;
  status: "loaded" | "integration" | "disabled";
};

export const ufOptions: UfOption[] = [
  { code: "RJ", name: "Rio de Janeiro", enabled: true, status: "loaded" },
  { code: "SP", name: "Sao Paulo", enabled: true, status: "loaded" },
  { code: "AC", name: "Acre", enabled: false, status: "disabled" },
  { code: "AL", name: "Alagoas", enabled: false, status: "disabled" },
  { code: "AP", name: "Amapa", enabled: false, status: "disabled" },
  { code: "AM", name: "Amazonas", enabled: false, status: "disabled" },
  { code: "BA", name: "Bahia", enabled: false, status: "disabled" },
  { code: "CE", name: "Ceara", enabled: false, status: "disabled" },
  { code: "DF", name: "Distrito Federal", enabled: false, status: "disabled" },
  { code: "ES", name: "Espirito Santo", enabled: true, status: "loaded" },
  { code: "GO", name: "Goias", enabled: false, status: "disabled" },
  { code: "MA", name: "Maranhao", enabled: false, status: "disabled" },
  { code: "MT", name: "Mato Grosso", enabled: false, status: "disabled" },
  { code: "MS", name: "Mato Grosso do Sul", enabled: false, status: "disabled" },
  { code: "MG", name: "Minas Gerais", enabled: true, status: "loaded" },
  { code: "PA", name: "Para", enabled: false, status: "disabled" },
  { code: "PB", name: "Paraiba", enabled: false, status: "disabled" },
  { code: "PR", name: "Parana", enabled: true, status: "loaded" },
  { code: "PE", name: "Pernambuco", enabled: false, status: "disabled" },
  { code: "PI", name: "Piaui", enabled: false, status: "disabled" },
  { code: "RN", name: "Rio Grande do Norte", enabled: false, status: "disabled" },
  { code: "RS", name: "Rio Grande do Sul", enabled: true, status: "loaded" },
  { code: "RO", name: "Rondonia", enabled: false, status: "disabled" },
  { code: "RR", name: "Roraima", enabled: false, status: "disabled" },
  { code: "SC", name: "Santa Catarina", enabled: true, status: "loaded" },
  { code: "SE", name: "Sergipe", enabled: false, status: "disabled" },
  { code: "TO", name: "Tocantins", enabled: false, status: "disabled" }
];

export function enabledUf(code: string | null | undefined): UfCode {
  const normalized = String(code ?? "RJ").toUpperCase();
  const option = ufOptions.find((item) => item.code === normalized && item.enabled);
  return option?.code ?? "RJ";
}

export function stateNameForUf(uf: UfCode): string {
  const names: Partial<Record<UfCode, string>> = {
    RJ: "Estado do Rio de Janeiro",
    SP: "Estado de São Paulo",
    PR: "Estado do Paraná",
    SC: "Estado de Santa Catarina",
    RS: "Estado do Rio Grande do Sul",
    MG: "Estado de Minas Gerais",
    ES: "Estado do Espírito Santo"
  };
  return names[uf] ?? uf;
}

export function preferredMunicipalityForUf(uf: UfCode): string {
  const names: Partial<Record<UfCode, string>> = {
    RJ: "Rio de Janeiro",
    SP: "São Paulo",
    PR: "Curitiba",
    SC: "Florianópolis",
    RS: "Porto Alegre",
    MG: "Belo Horizonte",
    ES: "Vitória"
  };
  return names[uf] ?? "";
}

export function sourceLabelForUf(uf: UfCode): string {
  const labels: Partial<Record<UfCode, string>> = {
    RJ: "RJ - ISP Dados Abertos",
    SP: "SP - SSP-SP + Sinesp",
    PR: "PR - Sinesp",
    SC: "SC - Sinesp",
    RS: "RS - Sinesp",
    MG: "MG - Sinesp",
    ES: "ES - Sinesp"
  };
  return labels[uf] ?? `${uf} - dados oficiais`;
}

export function analysisStartYearForUf(uf: UfCode): number {
  const years: Partial<Record<UfCode, number>> = {
    RJ: 2000,
    SP: 2015,
    PR: 2015,
    SC: 2015,
    RS: 2015,
    MG: 2015,
    ES: 2015
  };
  return years[uf] ?? 2015;
}
