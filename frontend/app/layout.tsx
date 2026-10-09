import type { Metadata } from "next";
import { Archivo, Shippori_Mincho_B1 } from "next/font/google";
import Link from "next/link";
import { Hotkeys } from "@/components/Hotkeys";
import { SiteNav } from "@/components/SiteNav";
import { StatusBar } from "@/components/StatusBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getSnapshotMeta } from "@/lib/api";
import { monthShort } from "@/lib/format";
import "./globals.css";

const mincho = Shippori_Mincho_B1({ weight: ["500", "700"], subsets: ["latin"], variable: "--font-mincho", display: "swap" });
const archivo = Archivo({ subsets: ["latin"], weight: "variable", axes: ["wdth"], variable: "--font-archivo", display: "swap" });

const DESCRIPTION =
  "Painel público de indicadores oficiais de violência e segurança pública no Estado do Rio de Janeiro: séries históricas desde 1991, municípios, áreas policiais, mapas e comparações por mandato.";

export const metadata: Metadata = {
  metadataBase: new URL("https://perdeu-playboy.online"),
  title: { default: "Perdeu, Playboy", template: "%s · Perdeu, Playboy" },
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const meta = getSnapshotMeta();
  const latest = meta.latest_period;

  return (
    <html lang="pt-BR" className={`${mincho.variable} ${archivo.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-paper text-sumi">
        <div className="app">
          <header className="app__header">
            <Link href="/" className="flex shrink-0 items-center gap-3 whitespace-nowrap text-ink">
              <Mark />
              <span className="wordmark text-[15px] leading-none">Perdeu, Playboy</span>
              <span className="eyebrow hidden text-[9px] 2xl:inline">· Rio de Janeiro · ISP</span>
            </Link>
            <SiteNav />
            <div className="flex shrink-0 items-center gap-3 whitespace-nowrap">
              <span className="num hidden text-[11px] tracking-[0.1em] text-ash xl:inline">
                até {monthShort(latest.month)} {latest.year}
              </span>
              <ThemeToggle />
            </div>
          </header>
          <main className="app__main">{children}</main>
          <StatusBar generatedAt={meta.generated_at} />
        </div>
        <Hotkeys />
      </body>
    </html>
  );
}

/** Marca mínima: um círculo com barras, eco do selo do tomoyo.systems. */
function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 34 34" aria-hidden="true" className="shrink-0 text-ink">
      <circle cx="17" cy="17" r="15.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 17h18M12 17v9M17 17v9M22 17v9M12 8v9M22 8v9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
