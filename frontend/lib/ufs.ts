export type UfCode =
  | "BR"
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
  { code: "BR", name: "Brasil", enabled: true, status: "loaded" },
  { code: "RJ", name: "Rio de Janeiro", enabled: true, status: "loaded" },
  { code: "SP", name: "Sao Paulo", enabled: true, status: "loaded" },
  { code: "AC", name: "Acre", enabled: true, status: "loaded" },
  { code: "AL", name: "Alagoas", enabled: true, status: "loaded" },
  { code: "AP", name: "Amapa", enabled: true, status: "loaded" },
  { code: "AM", name: "Amazonas", enabled: true, status: "loaded" },
  { code: "BA", name: "Bahia", enabled: true, status: "loaded" },
  { code: "CE", name: "Ceara", enabled: true, status: "loaded" },
  { code: "DF", name: "Distrito Federal", enabled: true, status: "loaded" },
  { code: "ES", name: "Espirito Santo", enabled: true, status: "loaded" },
  { code: "GO", name: "Goias", enabled: true, status: "loaded" },
  { code: "MA", name: "Maranhao", enabled: true, status: "loaded" },
  { code: "MT", name: "Mato Grosso", enabled: true, status: "loaded" },
  { code: "MS", name: "Mato Grosso do Sul", enabled: true, status: "loaded" },
  { code: "MG", name: "Minas Gerais", enabled: true, status: "loaded" },
  { code: "PA", name: "Para", enabled: true, status: "loaded" },
  { code: "PB", name: "Paraiba", enabled: true, status: "loaded" },
  { code: "PR", name: "Parana", enabled: true, status: "loaded" },
  { code: "PE", name: "Pernambuco", enabled: true, status: "loaded" },
  { code: "PI", name: "Piaui", enabled: true, status: "loaded" },
  { code: "RN", name: "Rio Grande do Norte", enabled: true, status: "loaded" },
  { code: "RS", name: "Rio Grande do Sul", enabled: true, status: "loaded" },
  { code: "RO", name: "Rondonia", enabled: true, status: "loaded" },
  { code: "RR", name: "Roraima", enabled: true, status: "loaded" },
  { code: "SC", name: "Santa Catarina", enabled: true, status: "loaded" },
  { code: "SE", name: "Sergipe", enabled: true, status: "loaded" },
  { code: "TO", name: "Tocantins", enabled: true, status: "loaded" }
];

export function enabledUf(code: string | null | undefined): UfCode {
  const normalized = String(code ?? "BR").toUpperCase();
  const option = ufOptions.find((item) => item.code === normalized && item.enabled);
  return option?.code ?? "BR";
}

export function stateNameForUf(uf: UfCode): string {
  const names: Partial<Record<UfCode, string>> = {
    BR: "Brasil",
    RJ: "Estado do Rio de Janeiro",
    SP: "Estado de São Paulo",
    PR: "Estado do Paraná",
    SC: "Estado de Santa Catarina",
    RS: "Estado do Rio Grande do Sul",
    MG: "Estado de Minas Gerais",
    ES: "Estado do Espírito Santo",
    GO: "Estado de Goiás",
    MT: "Estado de Mato Grosso",
    MS: "Estado de Mato Grosso do Sul",
    DF: "Distrito Federal",
    MA: "Estado do Maranhão",
    PI: "Estado do Piauí",
    CE: "Estado do Ceará",
    RN: "Estado do Rio Grande do Norte",
    PB: "Estado da Paraíba",
    PE: "Estado de Pernambuco",
    AL: "Estado de Alagoas",
    SE: "Estado de Sergipe",
    BA: "Estado da Bahia",
    RO: "Estado de Rondônia",
    AC: "Estado do Acre",
    AM: "Estado do Amazonas",
    RR: "Estado de Roraima",
    PA: "Estado do Pará",
    AP: "Estado do Amapá",
    TO: "Estado do Tocantins"
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
    ES: "Vitória",
    GO: "Goiânia",
    MT: "Cuiabá",
    MS: "Campo Grande",
    DF: "Brasília",
    MA: "São Luís",
    PI: "Teresina",
    CE: "Fortaleza",
    RN: "Natal",
    PB: "João Pessoa",
    PE: "Recife",
    AL: "Maceió",
    SE: "Aracaju",
    BA: "Salvador",
    RO: "Porto Velho",
    AC: "Rio Branco",
    AM: "Manaus",
    RR: "Boa Vista",
    PA: "Belém",
    AP: "Macapá",
    TO: "Palmas"
  };
  return names[uf] ?? "";
}

export function sourceLabelForUf(uf: UfCode): string {
  const labels: Partial<Record<UfCode, string>> = {
    BR: "Brasil - ISP / SSP-SP / Sinesp",
    RJ: "RJ - ISP Dados Abertos",
    SP: "SP - SSP-SP + Sinesp",
    PR: "PR - Sinesp",
    SC: "SC - Sinesp",
    RS: "RS - Sinesp",
    MG: "MG - Sinesp",
    ES: "ES - Sinesp",
    GO: "GO - Sinesp",
    MT: "MT - Sinesp",
    MS: "MS - Sinesp",
    DF: "DF - Sinesp",
    MA: "MA - Sinesp",
    PI: "PI - Sinesp",
    CE: "CE - Sinesp",
    RN: "RN - Sinesp",
    PB: "PB - Sinesp",
    PE: "PE - Sinesp",
    AL: "AL - Sinesp",
    SE: "SE - Sinesp",
    BA: "BA - Sinesp",
    RO: "RO - Sinesp",
    AC: "AC - Sinesp",
    AM: "AM - Sinesp",
    RR: "RR - Sinesp",
    PA: "PA - Sinesp",
    AP: "AP - Sinesp",
    TO: "TO - Sinesp"
  };
  return labels[uf] ?? `${uf} - dados oficiais`;
}

export function analysisStartYearForUf(uf: UfCode): number {
  const years: Partial<Record<UfCode, number>> = {
    BR: 2015,
    RJ: 2000,
    SP: 2015,
    PR: 2015,
    SC: 2015,
    RS: 2015,
    MG: 2015,
    ES: 2015,
    GO: 2015,
    MT: 2015,
    MS: 2015,
    DF: 2015,
    MA: 2015,
    PI: 2015,
    CE: 2015,
    RN: 2015,
    PB: 2015,
    PE: 2015,
    AL: 2015,
    SE: 2015,
    BA: 2015,
    RO: 2015,
    AC: 2015,
    AM: 2015,
    RR: 2015,
    PA: 2015,
    AP: 2015,
    TO: 2015
  };
  return years[uf] ?? 2015;
}
