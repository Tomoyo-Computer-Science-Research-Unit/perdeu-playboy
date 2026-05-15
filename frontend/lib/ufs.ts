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
  { code: "SP", name: "Sao Paulo", enabled: true, status: "integration" },
  { code: "AC", name: "Acre", enabled: false, status: "disabled" },
  { code: "AL", name: "Alagoas", enabled: false, status: "disabled" },
  { code: "AP", name: "Amapa", enabled: false, status: "disabled" },
  { code: "AM", name: "Amazonas", enabled: false, status: "disabled" },
  { code: "BA", name: "Bahia", enabled: false, status: "disabled" },
  { code: "CE", name: "Ceara", enabled: false, status: "disabled" },
  { code: "DF", name: "Distrito Federal", enabled: false, status: "disabled" },
  { code: "ES", name: "Espirito Santo", enabled: false, status: "disabled" },
  { code: "GO", name: "Goias", enabled: false, status: "disabled" },
  { code: "MA", name: "Maranhao", enabled: false, status: "disabled" },
  { code: "MT", name: "Mato Grosso", enabled: false, status: "disabled" },
  { code: "MS", name: "Mato Grosso do Sul", enabled: false, status: "disabled" },
  { code: "MG", name: "Minas Gerais", enabled: false, status: "disabled" },
  { code: "PA", name: "Para", enabled: false, status: "disabled" },
  { code: "PB", name: "Paraiba", enabled: false, status: "disabled" },
  { code: "PR", name: "Parana", enabled: false, status: "disabled" },
  { code: "PE", name: "Pernambuco", enabled: false, status: "disabled" },
  { code: "PI", name: "Piaui", enabled: false, status: "disabled" },
  { code: "RN", name: "Rio Grande do Norte", enabled: false, status: "disabled" },
  { code: "RS", name: "Rio Grande do Sul", enabled: false, status: "disabled" },
  { code: "RO", name: "Rondonia", enabled: false, status: "disabled" },
  { code: "RR", name: "Roraima", enabled: false, status: "disabled" },
  { code: "SC", name: "Santa Catarina", enabled: false, status: "disabled" },
  { code: "SE", name: "Sergipe", enabled: false, status: "disabled" },
  { code: "TO", name: "Tocantins", enabled: false, status: "disabled" }
];

export function enabledUf(code: string | null | undefined): UfCode {
  const normalized = String(code ?? "RJ").toUpperCase();
  const option = ufOptions.find((item) => item.code === normalized && item.enabled);
  return option?.code ?? "RJ";
}
