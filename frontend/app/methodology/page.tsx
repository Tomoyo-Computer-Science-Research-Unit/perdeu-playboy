import { Github } from "lucide-react";

const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/c3c4d4/perdeu-playboy";
const sources = [
  {
    label: "ISP Dados Abertos",
    description: "Indicadores de segurança pública do RJ usados no dashboard, tendências e rankings.",
    href: "https://www.ispdados.rj.gov.br/"
  },
  {
    label: "CSVs oficiais do ISP",
    description: "Séries mensais por estado, município e CISP baixadas de ispdados.rj.gov.br/Arquivos.",
    href: "https://www.ispdados.rj.gov.br/estatistica.html"
  },
  {
    label: "IBGE/SIDRA",
    description: "População municipal usada para taxa por 100 mil habitantes.",
    href: "https://sidra.ibge.gov.br/tabela/6579"
  },
  {
    label: "SSP-SP Números Sem Mistério",
    description: "Séries mensais oficiais de São Paulo por estado e município.",
    href: "https://www.ssp.sp.gov.br/estatistica/dados-mensais"
  },
  {
    label: "Sinesp VDE/MJSP",
    description: "Base nacional oficial usada para Paraná e Santa Catarina e como complemento de indicadores em SP.",
    href: "https://dados.mj.gov.br/dataset/sistema-nacional-de-estatisticas-de-seguranca-publica"
  },
  {
    label: "GENI/UFF + Instituto Fogo Cruzado",
    description: "Mapa Histórico dos Grupos Armados do Rio de Janeiro.",
    href: "https://fogocruzado.org.br/projetos/mapa-historico-dos-grupos-armados/"
  }
];

export default function MethodologyPage() {
  return (
    <div className="grid gap-8">
      <section className="border-l-4 border-border pl-4">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted">Metodologia</p>
          <h2 className="mt-1 text-4xl font-display text-foreground m-0 leading-none uppercase">Código e fontes</h2>
        </div>
      </section>

      <section className="border border-border bg-surface p-6 shadow-hard">
        <h3 className="m-0 text-2xl font-display uppercase tracking-wider text-foreground">Fontes dos dados</h3>
        <div className="mt-5 grid gap-4">
          {sources.map((source) => (
            <a
              key={source.href}
              href={source.href}
              target="_blank"
              rel="noreferrer"
              className="border-l-2 border-border pl-4 transition-colors hover:border-foreground"
            >
              <p className="font-mono text-sm font-bold uppercase tracking-widest text-foreground">{source.label}</p>
              <p className="mt-1 font-mono text-xs uppercase leading-5 tracking-wide text-muted">{source.description}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="border border-border bg-surface p-6 shadow-hard">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-3 font-mono text-sm font-bold uppercase tracking-widest text-foreground transition-colors hover:text-muted"
        >
          <Github size={18} aria-hidden="true" />
          GitHub do projeto
        </a>
      </section>
    </div>
  );
}
