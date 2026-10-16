/**
 * Tudo o que muda de uma UF para outra: nomes, fontes, textos de Método e Glossário, avisos por
 * indicador. Um build só serve todas as UFs publicadas: o Rio na raiz, as demais em /<uf>/; a UF
 * de uma página vem do caminho (`ufFromPath`). A lista de UFs é a de lib/ufs.json, a mesma que o
 * ETL e o build-site.sh leem. Os textos dependem da fonte: ISP (Rio), SSP-SP (São Paulo) ou Sinesp
 * VDE (qualquer outra UF), com o nome da UF no lugar certo. O Brasil (/br/) usa as mesmas telas: o
 * país no lugar do estado, as 27 UFs no lugar dos municípios, presidentes no lugar de governadores.
 */
import ufs from "@/lib/ufs.json";

export type UfSource = "isp" | "ssp" | "sinesp" | "brasil";
export type UfEntry = {
  code: string;
  ibge_code: number;
  name: string;
  state_name: string;
  capital: string;
  source: UfSource;
  start_year: number;
  published: boolean;
};

const ALL_UFS = ufs as UfEntry[];
/** UFs publicadas, na ordem do seletor do cabeçalho. */
export const PUBLISHED_UFS: UfEntry[] = ALL_UFS.filter((entry) => entry.published);
/** A UF da raiz do projeto (o Rio); as demais moram em /<uf minúscula>/. */
export const ROOT_UF = "RJ";
const ROOT_ENTRY = ALL_UFS.find((entry) => entry.code === ROOT_UF)!;

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function ufByCode(code: string | null | undefined): UfEntry | undefined {
  const key = (code ?? "").toUpperCase();
  return PUBLISHED_UFS.find((entry) => entry.code === key);
}

/** UF de um caminho sem basePath: "/sp/mapa" é São Paulo; o que não começa por uma UF publicada é o Rio. */
export function ufFromPath(pathname: string | null | undefined): UfEntry {
  const first = (pathname ?? "/").split("/").filter(Boolean)[0];
  const entry = ufByCode(first);
  return entry && entry.code !== ROOT_UF ? entry : ROOT_ENTRY;
}

/** Tela de um caminho, sem o prefixo da UF: "/sp/mapa/" vira "/mapa". */
export function screenFromPath(pathname: string | null | undefined): string {
  const path = pathname ?? "/";
  const entry = ufFromPath(path);
  const rest = entry.code === ROOT_UF ? path : path.replace(new RegExp(`^/${entry.code.toLowerCase()}(?=/|$)`), "");
  return rest.replace(/\/+$/, "") || "/";
}

/** Prefixo de rota (sem basePath): "" no Rio, "/sp" em São Paulo. */
export function ufPrefix(code: string): string {
  return code === ROOT_UF ? "" : `/${code.toLowerCase()}`;
}

/** Endereço (sem basePath) de uma tela numa UF: "/mapa" em SP vira "/sp/mapa/". */
export function ufHref(code: string, screen = "/"): string {
  const [path, query] = screen.split("?");
  const clean = path.startsWith("/") ? path : `/${path}`;
  const full = `${ufPrefix(code)}${clean === "/" ? "/" : clean.endsWith("/") ? clean : `${clean}/`}`;
  return query ? `${full}?${query}` : full;
}

/** A mesma tela em outra UF; Tiroteios, onde a UF não tem a tela, vira o Panorama. */
export function switchUfHref(code: string, pathname: string | null | undefined): string {
  const screen = screenFromPath(pathname);
  return ufHref(code, screen === "/tiroteios" && !configFor(code).hasShootings ? "/" : screen);
}

const DATA_VERSION = process.env.NEXT_PUBLIC_DATA_VERSION ?? "";

/** Endereço completo de um arquivo de dados da UF: <basePath>/data/<uf>/<file>?v=<build>. */
export function dataUrl(code: string, file: string): string {
  return `${BASE_PATH}/data/${code.toLowerCase()}/${file}${DATA_VERSION ? `?v=${DATA_VERSION}` : ""}`;
}

/** status.json da UF, escrito pelo build no servidor: <basePath>[/<uf>]/status.json. */
export function statusUrl(code: string): string {
  return `${BASE_PATH}${ufPrefix(code)}/status.json`;
}

export type SourceLine = { label: string; description: string; href: string };
export type Term = { title: string; body: string };

export type UfConfig = {
  code: string;
  /** UF de um município só (o Distrito Federal): sem ranking de municípios nem mapa por município. */
  singleMunicipality: boolean;
  /** Nome curto do estado, como em "Governadores de São Paulo". */
  name: string;
  /** Rótulo do recorte inteiro nos seletores ("Estado"; "Brasil" no nível nacional). */
  stateLabel: string;
  /** O território de baixo: "Município" nas UFs, "UF" no Brasil, e o plural ("Municípios", "UFs"). */
  unitLabel: string;
  unitPlural: string;
  unitPluralLower: string;
  stateName: string;
  capital: string;
  capitalLabel: string;
  sourceShort: string;
  /** Rótulo do tipo de território policial no seletor (CISP no Rio, DP em São Paulo). */
  policeAreaShort: string;
  policeAreaField: string;
  policeAreaPlural: string;
  otherPoliceAreasLabel: string;
  /** Mapa com drill-down para a capital (bairros por CISP no Rio). */
  mapDrilldown: boolean;
  cityMapLabel: string;
  hasShootings: boolean;
  /**
   * Indicador padrão de rankings, mapa e mudanças. No Rio é o crime geral; em São Paulo o crime geral
   * só existe para o estado (falta morte por intervenção por município), então vale homicídio doloso.
   */
  localIndicator: string;
  /** Indicador da tela Mudanças, no canto do painel, quando não é o crime geral (vazio no Rio). */
  changesIndicatorLabel: string;
  /** Nome curto das áreas policiais nos títulos da tela Mudanças. */
  policeAreaChangesLabel: string;
  governorsTitle: string;
  description: string;
  keywords: string[];
  sources: SourceLine[];
  steps: Array<[string, string]>;
  terms: Term[];
  glossaryAside: string;
  notes: Record<string, string>;
  rateFootPoliceArea: string;
  statusFilesTitle: string;
  statusModifiedLabel: string;
};

const SHARED_TERMS: Term[] = [
  { title: "Acumulado no ano", body: "Soma de janeiro até o último mês publicado, comparada com os mesmos meses do ano anterior." },
  { title: "Soma móvel de 12 meses", body: "Soma dos 12 meses terminados em cada mês. Elimina a sazonalidade." },
  { title: "Taxa por 100 mil", body: "Ocorrências ÷ população residente do ano × 100 mil. Só para anos completos." }
];

const STATE_UNITS = { stateLabel: "Estado", unitLabel: "Município", unitPlural: "Municípios", unitPluralLower: "municípios" };

const RJ: UfConfig = {
  code: "RJ",
  singleMunicipality: false,
  name: "Rio",
  ...STATE_UNITS,
  stateName: "Estado do Rio de Janeiro",
  capital: "Rio de Janeiro",
  capitalLabel: "Cidade do Rio de Janeiro",
  sourceShort: "ISP",
  policeAreaShort: "CISP",
  policeAreaField: "Área integrada",
  policeAreaPlural: "Áreas integradas (CISP)",
  otherPoliceAreasLabel: "Demais áreas do estado",
  mapDrilldown: true,
  cityMapLabel: "Cidade do Rio",
  hasShootings: true,
  localIndicator: "crime_geral",
  changesIndicatorLabel: "",
  policeAreaChangesLabel: "Áreas integradas (CISP)",
  governorsTitle: "Governadores do Rio",
  description:
    "Painel público de indicadores oficiais de violência e segurança pública no Estado do Rio de Janeiro: séries históricas desde 1991, municípios, áreas policiais, mapas e comparações por mandato.",
  keywords: ["Rio de Janeiro", "segurança pública", "violência", "ISP Dados Abertos", "letalidade violenta", "dados públicos", "série histórica"],
  sources: [
    {
      label: "ISP Dados Abertos",
      description: "Séries mensais do Instituto de Segurança Pública do RJ: estado desde 1991, área policial (CISP) desde 2003, município desde 2014, armas apreendidas por CISP desde 2007.",
      href: "https://www.ispdados.rj.gov.br/estatistica.html"
    },
    {
      label: "IBGE / SIDRA",
      description: "População residente por ano: censos de 1991, 2000, 2010 e 2022, contagem de 2007, estimativas anuais da tabela 6579. Os anos 1992–1999 e 2023, sem publicação, são interpolados.",
      href: "https://sidra.ibge.gov.br/tabela/6579"
    },
    {
      label: "IBGE Malhas",
      description: "Limites dos 92 municípios fluminenses, resolução mínima.",
      href: "https://servicodados.ibge.gov.br/api/docs/malhas?versao=3"
    },
    {
      label: "Data.Rio / IPP",
      description: "Limites dos bairros da cidade do Rio e população por bairro no Censo 2022.",
      href: "https://www.data.rio/"
    }
  ],
  steps: [
    ["Coleta", "Um fluxo automático baixa os CSVs do ISP e as tabelas do IBGE toda segunda-feira e guarda cada arquivo com seu SHA-256."],
    ["Normalização", "O CSV municipal do ISP mistura linhas em UTF-8 e latin-1; os nomes são corrigidos e alinhados à grafia da divisão territorial."],
    ["Sem dado", "Um mês em que o ISP ainda não apurava o indicador fica vazio e não entra em soma, mínimo ou variação. Vazio não é zero."],
    ["Acumulados", "Resumo e rankings somam de janeiro até o último mês publicado e comparam com os mesmos meses do ano anterior."],
    ["Taxas", "Ocorrências ÷ população do ano × 100 mil, só para anos completos. Áreas policiais não têm população oficial; bairros do Rio usam o Censo 2022."],
    ["Mandatos", "Média mensal de cada indicador durante o governo contra a média dos 12 meses anteriores à posse. Comparação descritiva."],
    [
      "Registro",
      "A série conta registros, não crimes. Tipos novos (feminicídio, publicado pelo ISP desde 2024), mudanças na lei (estupro, 2009) e variação na disposição de denunciar movem a série. Os indicadores afetados trazem o aviso no rodapé."
    ]
  ],
  terms: [
    { title: "Letalidade violenta", body: "Soma de homicídio doloso, latrocínio, lesão corporal seguida de morte e morte por intervenção de agente do Estado. Agregado criado pelo ISP." },
    { title: "Homicídio doloso", body: "Morte intencional registrada como homicídio. Latrocínio e morte por intervenção policial são contados à parte." },
    { title: "Latrocínio", body: "Roubo seguido de morte. Crime contra o patrimônio com resultado morte; também compõe a letalidade violenta." },
    { title: "Morte por intervenção de agente do Estado", body: "Morte causada por agente estatal em serviço, conforme o registro policial. Também compõe a letalidade violenta." },
    { title: "Feminicídio", body: "Homicídio de mulher por razões da condição de sexo feminino (Lei 13.104/2015). Na série do ISP desde outubro de 2024." },
    { title: "Roubo de rua", body: "Soma de roubo a transeunte, de celular e em coletivo, conforme a base do ISP." },
    { title: "Estupro", body: "Registros de estupro conforme a classificação policial. Série estadual desde 2003; a definição legal mudou em 2009." },
    { title: "CISP / área integrada", body: "Circunscrição Integrada de Segurança Pública: a área de uma delegacia. Menor unidade territorial dos dados do ISP; 138 no estado, 41 na capital." },
    ...SHARED_TERMS
  ],
  glossaryAside: "definições ISP",
  notes: {
    estupro:
      "A Lei 12.015, de 7 de agosto de 2009, incorporou ao estupro o antigo atentado violento ao pudor; a série salta em 2009. A disposição de denunciar também mudou no período.",
    feminicidio: "Tipificado pela Lei 13.104, de 9 de março de 2015. O ISP publica a série desde outubro de 2024; antes, esses casos entravam em homicídio doloso.",
    roubo_rua: "Soma de roubo a transeunte, de celular e em coletivo. O roubo de celular é o menos denunciado dos três e a taxa de denúncia variou ao longo da série.",
    morte_interv_policial: "Classificada pela própria polícia. O nome e o critério da categoria mudaram ao longo da série.",
    lesao_corp_morte: "Categoria com dezenas de casos por ano: a reclassificação de poucos registros como homicídio altera o total.",
    letalidade_violenta: "Soma de homicídio doloso, latrocínio, lesão corporal seguida de morte e morte por intervenção de agente do Estado.",
    apreensao_armas: "Mede atividade policial, não crime: mais apreensões podem refletir mais operações."
  },
  rateFootPoliceArea: "Sem população oficial por CISP: ordenado por ocorrências.",
  statusFilesTitle: "Arquivos do ISP",
  statusModifiedLabel: "Modificado no ISP"
};

const SP: UfConfig = {
  code: "SP",
  singleMunicipality: false,
  name: "São Paulo",
  ...STATE_UNITS,
  stateName: "Estado de São Paulo",
  capital: "São Paulo",
  capitalLabel: "Cidade de São Paulo",
  sourceShort: "SSP",
  policeAreaShort: "DP",
  policeAreaField: "Distrito policial",
  policeAreaPlural: "Distritos policiais da capital",
  otherPoliceAreasLabel: "Demais distritos",
  mapDrilldown: false,
  cityMapLabel: "Cidade de São Paulo",
  hasShootings: false,
  localIndicator: "homicidio_doloso",
  changesIndicatorLabel: "homicídio doloso",
  policeAreaChangesLabel: "DPs",
  governorsTitle: "Governadores de São Paulo",
  description:
    "Painel público de indicadores oficiais de violência e segurança pública no Estado de São Paulo: séries mensais da SSP-SP desde 2001, 645 municípios, distritos policiais da capital, mapa e comparações por mandato.",
  keywords: ["São Paulo", "segurança pública", "violência", "SSP-SP", "Números sem Mistério", "dados públicos", "série histórica"],
  sources: [
    {
      label: "SSP-SP, dados mensais",
      description:
        "Ocorrências por natureza e produtividade policial do portal Números sem Mistério da Secretaria da Segurança Pública: estado e 93 distritos policiais da capital desde janeiro de 2001; 645 municípios desde janeiro de 2023 (os anos anteriores entram aos poucos na coleta diária).",
      href: "https://www.ssp.sp.gov.br/estatistica/dados-mensais"
    },
    {
      label: "SSP-SP, violência contra a mulher",
      description: "Feminicídio mensal do estado, desde janeiro de 2018.",
      href: "https://www.ssp.sp.gov.br/estatistica/violencia-contra-a-mulher"
    },
    {
      label: "Sinesp VDE / MJSP",
      description:
        "Morte por intervenção de agente do Estado, total estadual mensal desde 2015. As tabelas mensais da SSP-SP não trazem esse indicador; o Sinesp recebe o dado da própria SSP-SP, sem recorte por município.",
      href: "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/dados-nacionais-1/base-de-dados-e-notas-metodologicas-dos-gestores-estaduais-sinesp-vde-2022-e-2023"
    },
    {
      label: "IBGE / SIDRA",
      description: "População residente por ano: censos de 2000, 2010 e 2022, contagem de 2007, estimativas anuais da tabela 6579. O ano de 2023, sem publicação, é interpolado.",
      href: "https://sidra.ibge.gov.br/tabela/6579"
    },
    {
      label: "IBGE Malhas",
      description: "Limites dos 645 municípios paulistas, resolução mínima.",
      href: "https://servicodados.ibge.gov.br/api/docs/malhas?versao=3"
    }
  ],
  steps: [
    ["Coleta", "Um fluxo automático consulta a API do portal da SSP-SP, uma chamada por segundo, e guarda as respostas; anos fechados não são baixados de novo."],
    ["Naturezas", "Homicídio doloso e latrocínio contam vítimas, como no ISP; as demais naturezas contam ocorrências. Roubo (outros) é o total de roubos menos carga e banco."],
    ["Sem dado", "Mês ainda não publicado, ou natureza que a SSP-SP não separava (lesão corporal seguida de morte antes de setembro de 2016), fica vazio. Vazio não é zero."],
    ["Acumulados", "Resumo e rankings somam de janeiro até o último mês publicado e comparam com os mesmos meses do ano anterior."],
    ["Taxas", "Ocorrências ÷ população do ano × 100 mil, só para anos completos. Distritos policiais não têm população oficial."],
    ["Mandatos", "Média mensal de cada indicador durante o governo contra a média dos 12 meses anteriores à posse. Comparação descritiva; Covas tomou posse antes do início da série."],
    [
      "Registro",
      "A série conta boletins de ocorrência, não crimes. Mudanças na lei (estupro, 2009), naturezas novas (feminicídio, 2018) e variação na disposição de denunciar movem a série."
    ]
  ],
  terms: [
    {
      title: "Letalidade violenta",
      body: "Soma de homicídio doloso, latrocínio, lesão corporal seguida de morte e morte por intervenção de agente do Estado, a mesma composição do ISP. Em São Paulo só existe para o estado, desde setembro de 2016."
    },
    { title: "Homicídio doloso", body: "Vítimas de homicídio doloso nos boletins da SSP-SP. Latrocínio e morte por intervenção policial são contados à parte." },
    { title: "Latrocínio", body: "Vítimas de roubo seguido de morte. Também compõe a letalidade violenta." },
    {
      title: "Morte por intervenção de agente do Estado",
      body: "Morte causada por agente estatal, conforme o registro policial. Total estadual do Sinesp VDE, desde 2015; a SSP-SP não publica o dado por município nas tabelas mensais."
    },
    { title: "Feminicídio", body: "Homicídio de mulher por razões da condição de sexo feminino (Lei 13.104/2015). Série estadual da SSP-SP desde 2018." },
    {
      title: "Roubo (outros)",
      body: "Total de roubos da SSP-SP menos roubo de veículo, de carga e a banco: pessoas na rua, celulares, residências, comércio. Não equivale ao roubo de rua do ISP."
    },
    { title: "Estupro", body: "Total de estupro da SSP-SP, que soma estupro e estupro de vulnerável. A definição legal mudou em 2009." },
    { title: "Crime geral", body: "Letalidade violenta, roubo (outros), roubo de veículo, roubo de carga e estupro. Só para o estado, desde setembro de 2016." },
    { title: "DP / distrito policial", body: "Área de uma delegacia de polícia. A SSP-SP publica dados de 93 distritos numerados na capital; não há mapa oficial dos limites." },
    ...SHARED_TERMS
  ],
  glossaryAside: "definições SSP-SP",
  notes: {
    estupro:
      "A Lei 12.015, de 7 de agosto de 2009, incorporou ao estupro o antigo atentado violento ao pudor; a série salta em 2009. A disposição de denunciar também mudou no período.",
    feminicidio: "Tipificado pela Lei 13.104, de 9 de março de 2015. A SSP-SP publica a série estadual desde janeiro de 2018; antes, esses casos entravam em homicídio doloso.",
    roubo_outros: "Total de roubos menos veículo, carga e banco. Inclui roubo a pessoa, de celular, a residência e a comércio; não se compara ao roubo de rua do ISP.",
    morte_interv_policial: "Total estadual do Sinesp VDE, desde 2015. Classificada pela própria polícia.",
    lesao_corp_morte: "A SSP-SP publica a categoria em separado desde setembro de 2016.",
    letalidade_violenta: "Soma de homicídio doloso, latrocínio, lesão corporal seguida de morte e morte por intervenção de agente do Estado; só para o estado, desde setembro de 2016.",
    apreensao_armas: "Mede atividade policial, não crime: mais apreensões podem refletir mais operações."
  },
  rateFootPoliceArea: "Sem população oficial por distrito policial: ordenado por ocorrências.",
  statusFilesTitle: "Arquivos da SSP-SP e do Sinesp",
  statusModifiedLabel: "Modificado na fonte"
};

/** Textos de uma UF servida pelo Sinesp VDE: os mesmos para todas, com o nome e a capital da UF. */
function sinespConfig(entry: UfEntry): UfConfig {
  return {
    code: entry.code,
    singleMunicipality: entry.code === "DF",
    name: entry.name,
    ...STATE_UNITS,
    stateName: entry.state_name,
    capital: entry.capital,
    capitalLabel: `Capital (${entry.capital})`,
    sourceShort: "Sinesp",
    policeAreaShort: "Área",
    policeAreaField: "Área policial",
    policeAreaPlural: "Áreas policiais",
    otherPoliceAreasLabel: "Demais áreas",
    mapDrilldown: false,
    cityMapLabel: entry.capital,
    hasShootings: false,
    localIndicator: "homicidio_doloso",
    changesIndicatorLabel: "homicídio doloso",
    policeAreaChangesLabel: "Áreas policiais",
    governorsTitle: `Governadores · ${entry.name}`,
    description: `Painel público de indicadores oficiais de violência e segurança pública: ${entry.state_name}, dados mensais do Sinesp VDE (Ministério da Justiça) desde 2015, municípios, mapa e comparações por mandato.`,
    keywords: [entry.name, "segurança pública", "violência", "Sinesp", "dados públicos", "série histórica"],
    sources: [
      {
        label: "Sinesp VDE / MJSP",
        description: `Arquivos anuais do Ministério da Justiça e Segurança Pública com os registros enviados pela secretaria de segurança: ${entry.state_name}, mensal, desde janeiro de 2015. Homicídio doloso, latrocínio, lesão corporal seguida de morte e feminicídio por município; os demais eventos só com o total estadual.`,
        href: "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/dados-nacionais-1/base-de-dados-e-notas-metodologicas-dos-gestores-estaduais-sinesp-vde-2022-e-2023"
      },
      {
        label: "IBGE / SIDRA",
        description: "População residente por ano: censos de 2010 e 2022, estimativas anuais da tabela 6579. O ano de 2023, sem publicação, é interpolado.",
        href: "https://sidra.ibge.gov.br/tabela/6579"
      },
      {
        label: "IBGE Malhas",
        description: `Limites dos municípios (${entry.name}), resolução mínima.`,
        href: "https://servicodados.ibge.gov.br/api/docs/malhas?versao=3"
      }
    ],
    steps: [
      ["Coleta", "Um fluxo automático baixa os arquivos anuais do Sinesp VDE e guarda só a UF, os eventos usados e a abrangência estadual."],
      ["Naturezas", "Eventos com vítima (homicídio, latrocínio, lesão seguida de morte, feminicídio, morte por intervenção, estupro) contam vítimas; roubos e armas contam ocorrências."],
      ["Sem dado", "Meses depois do último publicado vêm zerados no arquivo e ficam vazios. Vazio não é zero."],
      ["Acumulados", "Resumo e rankings somam de janeiro até o último mês publicado e comparam com os mesmos meses do ano anterior."],
      ["Taxas", "Ocorrências ÷ população do ano × 100 mil, só para anos completos."],
      ["Mandatos", "Média mensal de cada indicador durante o governo contra a média dos 12 meses anteriores à posse. Comparação descritiva."],
      ["Registro", "A série conta registros policiais, não crimes. O Sinesp começa em 2015; a qualidade do envio varia entre estados e anos."]
    ],
    terms: [
      {
        title: "Letalidade violenta",
        body: "Soma de homicídio doloso, latrocínio, lesão corporal seguida de morte e morte por intervenção de agente do Estado. Só para o estado: o Sinesp não traz morte por intervenção por município."
      },
      { title: "Homicídio doloso", body: "Vítimas de homicídio doloso no Sinesp VDE." },
      { title: "Latrocínio", body: "Vítimas de roubo seguido de morte." },
      { title: "Morte por intervenção de agente do Estado", body: "Morte causada por agente estatal, conforme o registro policial. Total estadual." },
      { title: "Feminicídio", body: "Homicídio de mulher por razões da condição de sexo feminino (Lei 13.104/2015)." },
      { title: "Estupro", body: "Vítimas de estupro e de estupro de vulnerável. Total estadual." },
      { title: "Crime geral", body: "Letalidade violenta, roubo de veículo, roubo de carga e estupro. O Sinesp não tem roubo a pessoa. Só para o estado." },
      ...SHARED_TERMS
    ],
    glossaryAside: "definições Sinesp",
    notes: {
      estupro: "Soma estupro e estupro de vulnerável. Total estadual.",
      feminicidio: "Tipificado pela Lei 13.104, de 9 de março de 2015.",
      morte_interv_policial: "Total estadual do Sinesp VDE. Classificada pela própria polícia.",
      letalidade_violenta: "Soma de homicídio doloso, latrocínio, lesão corporal seguida de morte e morte por intervenção de agente do Estado; só para o estado.",
      apreensao_armas: "Mede atividade policial, não crime: mais apreensões podem refletir mais operações."
    },
    rateFootPoliceArea: "",
    statusFilesTitle: "Arquivos do Sinesp",
    statusModifiedLabel: "Modificado na fonte"
  };
}

const SINESP_HREF =
  "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/dados-nacionais-1/base-de-dados-e-notas-metodologicas-dos-gestores-estaduais-sinesp-vde-2022-e-2023";

/** Brasil: o país no papel do estado, as 27 UFs no dos municípios, presidentes no dos governadores. */
function brasilConfig(entry: UfEntry): UfConfig {
  return {
    code: entry.code,
    singleMunicipality: false,
    name: entry.name,
    stateLabel: "Brasil",
    unitLabel: "UF",
    unitPlural: "UFs",
    unitPluralLower: "UFs",
    stateName: entry.state_name,
    capital: entry.capital,
    capitalLabel: entry.capital,
    sourceShort: "Sinesp",
    policeAreaShort: "Área",
    policeAreaField: "Área policial",
    policeAreaPlural: "Áreas policiais",
    otherPoliceAreasLabel: "Demais áreas",
    mapDrilldown: false,
    cityMapLabel: entry.capital,
    hasShootings: false,
    localIndicator: "homicidio_doloso",
    changesIndicatorLabel: "homicídio doloso",
    policeAreaChangesLabel: "Áreas policiais",
    governorsTitle: "Presidentes",
    description:
      "Painel público de indicadores oficiais de violência e segurança pública no Brasil: soma das 27 UFs no Sinesp VDE (Ministério da Justiça) desde 2015, comparação entre estados, mapa e comparação entre presidentes.",
    keywords: ["Brasil", "segurança pública", "violência", "Sinesp", "homicídios por estado", "dados públicos", "série histórica"],
    sources: [
      {
        label: "Sinesp VDE / MJSP",
        description:
          "Arquivos anuais do Ministério da Justiça e Segurança Pública com os registros enviados pelas 27 secretarias de segurança, mensais, desde janeiro de 2015. Rio de Janeiro e São Paulo entram por aqui, não pelo ISP e pela SSP-SP.",
        href: SINESP_HREF
      },
      {
        label: "IBGE / SIDRA",
        description: "População residente do Brasil e das UFs por ano: censos de 2010 e 2022, estimativas anuais da tabela 6579. O ano de 2023, sem publicação, é interpolado.",
        href: "https://sidra.ibge.gov.br/tabela/6579"
      },
      {
        label: "IBGE Malhas",
        description: "Limites das 27 UFs (malha do país com divisão por UF), resolução mínima.",
        href: "https://servicodados.ibge.gov.br/api/docs/malhas?versao=3"
      }
    ],
    steps: [
      ["Coleta", "Os arquivos anuais do Sinesp VDE são os mesmos das páginas de cada UF; o total do país é refeito depois delas, todo dia."],
      [
        "Soma",
        "Um indicador num mês só tem total nacional se as 27 UFs mandaram o dado. Faltando uma, o mês fica vazio: nunca a soma das outras 26. Zero enviado é zero."
      ],
      [
        "Cobertura",
        "Pela regra da soma, homicídio, latrocínio, lesão seguida de morte e feminicídio começam em 2016-01 (o Espírito Santo não mandou 2015); roubo de veículo e armas apreendidas, em 2021-01. Roubo de carga começa em 2021-01 e tem meses vazios entre 2023 e 2025."
      ],
      [
        "Rio e São Paulo",
        "Entram pelo Sinesp, como as outras 25 UFs. O ISP soma roubo de rua e a SSP-SP conta ocorrências onde o Sinesp conta vítimas; somar fontes diferentes não daria uma série nacional. Os números diferem dos das páginas desses dois estados."
      ],
      ["Taxas", "Ocorrências ÷ população do ano × 100 mil, só para anos completos."],
      [
        "Mandatos",
        "Presidentes: média mensal de cada indicador no mandato contra a média dos 12 meses anteriores à posse. Dilma tomou posse em 2011, antes da série, e fica sem base; Temer aparece duas vezes, interino (12/5 a 30/8/2016) e titular."
      ],
      ["Registro", "A série conta registros policiais, não crimes. A qualidade do envio varia entre estados e anos."]
    ],
    terms: [
      { title: "Total nacional", body: "Soma das 27 UFs no Sinesp VDE. Existe num mês só quando todas mandaram o dado." },
      { title: "Letalidade violenta", body: "Soma de homicídio doloso, latrocínio, lesão corporal seguida de morte e morte por intervenção de agente do Estado." },
      { title: "Homicídio doloso", body: "Vítimas de homicídio doloso no Sinesp VDE." },
      { title: "Latrocínio", body: "Vítimas de roubo seguido de morte." },
      { title: "Morte por intervenção de agente do Estado", body: "Morte causada por agente estatal, conforme o registro policial." },
      { title: "Feminicídio", body: "Homicídio de mulher por razões da condição de sexo feminino (Lei 13.104/2015)." },
      { title: "Estupro", body: "Vítimas de estupro e de estupro de vulnerável." },
      { title: "Crime geral", body: "Letalidade violenta, roubo de veículo, roubo de carga e estupro. O Sinesp não tem roubo a pessoa." },
      ...SHARED_TERMS
    ],
    glossaryAside: "definições Sinesp",
    notes: {
      estupro: "Soma estupro e estupro de vulnerável.",
      feminicidio: "Tipificado pela Lei 13.104, de 9 de março de 2015.",
      morte_interv_policial: "Classificada pela própria polícia de cada estado.",
      roubo_carga: "Sem total nacional antes de 2021, em 2023, em 2024 e em fevereiro e março de 2025: Mato Grosso do Sul não mandou esses meses.",
      letalidade_violenta: "Soma de homicídio doloso, latrocínio, lesão corporal seguida de morte e morte por intervenção de agente do Estado.",
      apreensao_armas: "Mede atividade policial, não crime: mais apreensões podem refletir mais operações."
    },
    rateFootPoliceArea: "",
    statusFilesTitle: "Arquivos do Sinesp",
    statusModifiedLabel: "Modificado na fonte"
  };
}

const CONFIGS = new Map<string, UfConfig>();

/** Textos de uma UF (por sigla ou entrada). */
export function configFor(entry: UfEntry | string): UfConfig {
  const resolved = typeof entry === "string" ? ufByCode(entry) ?? ROOT_ENTRY : entry;
  let config = CONFIGS.get(resolved.code);
  if (!config) {
    config =
      resolved.source === "isp" ? RJ : resolved.source === "ssp" ? SP : resolved.source === "brasil" ? brasilConfig(resolved) : sinespConfig(resolved);
    CONFIGS.set(resolved.code, config);
  }
  return config;
}

let CURRENT: UfConfig = RJ;

/** Instala a UF cujos dados estão carregados (DataGate, junto com o núcleo). */
export function setCurrentUf(code: string): void {
  CURRENT = configFor(code);
}

/** Textos da UF da tela em exibição; só vale dentro de DataGate. */
export function ufConfig(): UfConfig {
  return CURRENT;
}
