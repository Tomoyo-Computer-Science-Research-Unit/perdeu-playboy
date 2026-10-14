import type { Metadata } from "next";
import { Archivo, Shippori_Mincho_B1 } from "next/font/google";
import Link from "next/link";
import { Fx } from "@/components/Fx";
import { Hotkeys } from "@/components/Hotkeys";
import { SiteNav } from "@/components/SiteNav";
import { StatusBar } from "@/components/StatusBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getSnapshotMeta } from "@/lib/api";
import { monthShort } from "@/lib/format";
import { cursorVars } from "@/lib/cursors";
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
    images: [{ url: "/embed.png", width: 640, height: 480, alt: "Perdeu, Playboy" }]
  },
  twitter: { card: "summary_large_image", title: "Perdeu, Playboy", description: DESCRIPTION, images: ["/embed.png"] },
  icons: { icon: `${BASE_PATH}/favicon.png`, shortcut: `${BASE_PATH}/favicon.png`, apple: `${BASE_PATH}/favicon.png` }
};

// O tema segue o sistema e muda junto com ele; T inverte só nesta visita. Aplicado antes da
// primeira pintura para não piscar.
const THEME_SCRIPT = `(() => {
  const media = matchMedia('(prefers-color-scheme: dark)');
  const apply = (dark) => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    window.dispatchEvent(new CustomEvent('pp-theme'));
  };
  apply(media.matches);
  media.addEventListener('change', (e) => apply(e.matches));
})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const latest = getSnapshotMeta().latest_period;

  return (
    <html
      lang="pt-BR"
      className={`${mincho.variable} ${archivo.variable}`}
      style={cursorVars(BASE_PATH)}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-paper text-sumi">
        <div className="app">
          <header className="app__header">
            <span className="flex shrink-0 items-center gap-3 whitespace-nowrap text-ink" data-brand>
              {/* O mon da Tomoyo com sangue no olho direito leva de volta à home do g0v. */}
              <a href="https://g0v.tomoyo.systems/" aria-label="g0v.tomoyo.systems" data-brand>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${BASE_PATH}/logo_perdeu-playboy.png`} alt="" width={30} height={30} className="h-[30px] w-[30px] shrink-0" data-brand />
              </a>
              <Link href="/" className="wordmark text-[14px] uppercase leading-none" data-brand>
                Perdeu, Playboy
              </Link>
            </span>
            <SiteNav />
            <ThemeToggle />
          </header>
          <main className="app__main">{children}</main>
          <StatusBar latestLabel={`ISP ${monthShort(latest.month)} ${latest.year}`} />
        </div>
        <Hotkeys />
        <Fx />
      </body>
    </html>
  );
}
