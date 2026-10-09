import type { Metadata } from "next";
import { Archivo, Shippori_Mincho_B1 } from "next/font/google";
import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getSnapshotMeta } from "@/lib/api";
import { formatDateTime, monthLong } from "@/lib/format";
import "./globals.css";

const mincho = Shippori_Mincho_B1({ weight: ["500", "700"], subsets: ["latin"], variable: "--font-mincho", display: "swap" });
const archivo = Archivo({ subsets: ["latin"], weight: "variable", axes: ["wdth"], variable: "--font-archivo", display: "swap" });

const DESCRIPTION =
  "Painel público de indicadores oficiais de violência e segurança pública no Estado do Rio de Janeiro: séries históricas desde 1991, municípios, áreas policiais, mapas e comparações por mandato.";

export const metadata: Metadata = {
  metadataBase: new URL("https://perdeu-playboy.online"),
  title: {
    default: "Perdeu, Playboy",
    template: "%s · Perdeu, Playboy"
  },
  description: DESCRIPTION,
  applicationName: "Perdeu, Playboy",
  authors: [{ name: "Tomoyo", url: "https://tomoyo.systems" }],
  creator: "Tomoyo",
  publisher: "Tomoyo",
  keywords: ["Rio de Janeiro", "segurança pública", "violência", "ISP Dados Abertos", "letalidade violenta", "dados públicos", "série histórica"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://perdeu-playboy.online",
    siteName: "Perdeu, Playboy",
    title: "Perdeu, Playboy",
    description: DESCRIPTION,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Perdeu, Playboy" }]
  },
  twitter: { card: "summary_large_image", title: "Perdeu, Playboy", description: DESCRIPTION, images: ["/og-image.png"] },
  icons: { icon: "/favicon.png", shortcut: "/favicon.png", apple: "/favicon.png" }
};

// Aplica o tema antes da primeira pintura para não piscar (mesma técnica do tomoyo.systems).
const THEME_SCRIPT = `(() => {
  let saved = null;
  try { saved = localStorage.getItem('pp-theme'); } catch (e) {}
  const dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();`;

const FOOTER_COLUMNS = [
  {
    title: "Dados",
    links: [
      { href: "/", label: "Panorama" },
      { href: "/trends", label: "Séries históricas" },
      { href: "/map", label: "Mapa" },
      { href: "/rankings", label: "Rankings" },
      { href: "/changes", label: "Mudanças" },
      { href: "/governors", label: "Mandatos" }
    ]
  },
  {
    title: "Sobre",
    links: [
      { href: "/methodology", label: "Metodologia" },
      { href: "/glossary", label: "Glossário" },
      { href: "/sources", label: "Fontes e checksums" }
    ]
  },
  {
    title: "Fontes",
    links: [
      { href: "https://www.ispdados.rj.gov.br/", label: "ISP Dados Abertos", external: true },
      { href: "https://sidra.ibge.gov.br/tabela/6579", label: "IBGE / SIDRA", external: true },
      { href: "https://www.data.rio/", label: "Data.Rio", external: true }
    ]
  },
  {
    title: "Tomoyo",
    links: [
      { href: "https://tomoyo.systems", label: "tomoyo.systems", external: true },
      { href: "https://github.com/Tomoyo-Computer-Science-Research-Unit/perdeu-playboy", label: "Código-fonte", external: true },
      { href: "https://x.com/333tomoyo", label: "X", external: true }
    ]
  }
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const meta = getSnapshotMeta();
  const latest = meta.latest_period;

  return (
    <html lang="pt-BR" className={`${mincho.variable} ${archivo.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-paper text-sumi">
        <header className="wrap">
          <div className="flex items-center justify-between gap-6 py-7 sm:py-9">
            <Link href="/" className="group flex items-center gap-4 text-ink">
              <Mark />
              <span className="flex flex-col">
                <span className="wordmark text-[20px] leading-none sm:text-[22px]">Perdeu, Playboy</span>
                <span className="eyebrow mt-2 hidden text-[9px] sm:block">Segurança pública · Rio de Janeiro · desde 1991</span>
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <span className="hidden text-[11px] tracking-[0.12em] text-ash md:inline">
                ISP até {monthLong(latest.month)} de {latest.year}
              </span>
              <ThemeToggle />
            </div>
          </div>
          <SiteNav />
        </header>

        <main className="wrap pb-24 pt-10 sm:pt-14">{children}</main>

        <footer className="wrap mt-16 border-t border-line pt-12 pb-10">
          <div className="grid gap-10 md:grid-cols-[1.2fr_repeat(4,1fr)]">
            <div className="flex items-start gap-4">
              <Mark />
              <div>
                <p className="wordmark text-[18px] text-ink">Perdeu, Playboy</p>
                <p className="mt-3 max-w-[32ch] text-[12.5px] leading-7 text-ash">
                  Dados oficiais do Instituto de Segurança Pública do Rio de Janeiro, organizados como informação cívica. Sem
                  identificação de vítimas, sem linguagem sensacionalista.
                </p>
              </div>
            </div>
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="serif border-b border-line pb-2 text-[13px] tracking-[0.14em] text-ink">{column.title}</p>
                <ul className="mt-3 space-y-1.5 text-[12.5px] text-slate">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      {"external" in link && link.external ? (
                        <a href={link.href} target="_blank" rel="noreferrer" className="hover:text-ink hover:underline hover:underline-offset-4">
                          {link.label}
                        </a>
                      ) : (
                        <Link href={link.href} className="hover:text-ink hover:underline hover:underline-offset-4">
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col gap-2 border-t border-line pt-5 text-[11px] tracking-[0.1em] text-ash sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} Tomoyo · g0v brazil. Dados públicos, código aberto.</span>
            <span>Snapshot gerado em {formatDateTime(meta.generated_at)}</span>
          </div>
        </footer>
      </body>
    </html>
  );
}

/** Marca mínima: um círculo com barras, eco do selo do tomoyo.systems. */
function Mark() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true" className="shrink-0 text-ink">
      <circle cx="17" cy="17" r="15.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 17h18M12 17v9M17 17v9M22 17v9M12 8v9M22 8v9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
