import type { Metadata } from "next";
import { Archivo, Shippori_Mincho_B1 } from "next/font/google";
import { Fx } from "@/components/Fx";
import { Hotkeys } from "@/components/Hotkeys";
import { HomeLink } from "@/components/UfLink";
import { SiteNav } from "@/components/SiteNav";
import { StatusBar } from "@/components/StatusBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UfSelector } from "@/components/UfSelector";
import { cursorVars } from "@/lib/cursors";
import { DataGate } from "@/components/DataGate";
import { BASE_PATH, configFor, ROOT_UF } from "@/lib/uf";
import "./globals.css";

const mincho = Shippori_Mincho_B1({ weight: ["500", "700"], subsets: ["latin"], variable: "--font-mincho", display: "swap" });
const archivo = Archivo({ subsets: ["latin"], weight: "variable", axes: ["wdth"], variable: "--font-archivo", display: "swap" });

const ROOT_CONFIG = configFor(ROOT_UF);
const DESCRIPTION = ROOT_CONFIG.description;
const SITE_URL = `https://g0v.tomoyo.systems${BASE_PATH}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Perdeu, Playboy", template: "%s · Perdeu, Playboy" },
  description: DESCRIPTION,
  applicationName: "Perdeu, Playboy",
  authors: [{ name: "Tomoyo", url: "https://tomoyo.systems" }],
  creator: "Tomoyo",
  publisher: "Tomoyo",
  keywords: ROOT_CONFIG.keywords,
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
  return (
    <html
      lang="pt-BR"
      className={`${mincho.variable} ${archivo.variable}`}
      style={cursorVars(BASE_PATH)}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* Discord flutuante comum aos sites do g0v (servido pela landing, na raiz do domínio). */}
        <script src="/discord-float.js" defer />
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
              <HomeLink className="wordmark text-[14px] uppercase leading-none" data-brand>
                Perdeu, Playboy
              </HomeLink>
            </span>
            <SiteNav />
            <span className="flex shrink-0 items-center gap-2">
              <UfSelector />
              <ThemeToggle />
            </span>
          </header>
          <main className="app__main">
            <DataGate>{children}</DataGate>
          </main>
          <StatusBar />
        </div>
        <Hotkeys />
        <Fx />
      </body>
    </html>
  );
}
