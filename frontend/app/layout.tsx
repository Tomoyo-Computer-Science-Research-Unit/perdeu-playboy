import type { Metadata } from "next";
import { Archivo, Shippori_Mincho_B1 } from "next/font/google";
import Link from "next/link";
import { Fx } from "@/components/Fx";
import { Hotkeys } from "@/components/Hotkeys";
import { Scope } from "@/components/Scope";
import { Shatter } from "@/components/Shatter";
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

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const SITE_URL = `https://g0v.tomoyo.systems${BASE_PATH}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
    url: SITE_URL,
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
  const latest = getSnapshotMeta().latest_period;

  return (
    <html lang="pt-BR" className={`${mincho.variable} ${archivo.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-paper text-sumi">
        <div className="app">
          <header className="app__header">
            <Link href="/" className="flex shrink-0 items-center gap-3 whitespace-nowrap text-ink" data-brand>
              {/* O mon da Tomoyo com sangue no olho direito: marca do projeto, inquebrável. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${BASE_PATH}/logo_perdeu-playboy.png`} alt="" width={30} height={30} className="h-[30px] w-[30px] shrink-0" data-brand />
              <span className="wordmark text-[15px] leading-none" data-brand>
                Perdeu, Playboy
              </span>
            </Link>
            <SiteNav />
            <ThemeToggle />
          </header>
          <main className="app__main">{children}</main>
          <StatusBar latestLabel={`ISP ${monthShort(latest.month)} ${latest.year}`} />
        </div>
        <Hotkeys />
        <Fx />
        <Scope />
        <Shatter />
      </body>
    </html>
  );
}
