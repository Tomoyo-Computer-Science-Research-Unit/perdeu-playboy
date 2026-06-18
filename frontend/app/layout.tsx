import type { Metadata } from "next";
import { Inter, Roboto_Mono, Bebas_Neue } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { UfSelector } from "@/components/UfSelector";
import { SiteNav } from "@/components/SiteNav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const robotoMono = Roboto_Mono({ subsets: ["latin"], variable: "--font-roboto-mono" });
const bebasNeue = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas-neue" });

export const metadata: Metadata = {
  metadataBase: new URL("https://perdeu-playboy.online"),
  title: {
    default: "Perdeu, Playboy",
    template: "%s | Perdeu, Playboy"
  },
  description: "Painel publico de indicadores oficiais de violencia e seguranca publica nos 26 estados e no Distrito Federal, com series historicas, mapas, rankings e comparacoes por governo.",
  applicationName: "Perdeu, Playboy",
  authors: [{ name: "g0v brazil & tomoyo", url: "https://x.com/333tomoyo" }],
  creator: "g0v brazil & tomoyo",
  publisher: "g0v brazil & tomoyo",
  keywords: [
    "Brasil",
    "seguranca publica",
    "violencia",
    "estatisticas criminais",
    "homicidio",
    "ISP Dados Abertos",
    "SSP-SP",
    "Sinesp VDE",
    "dados publicos",
    "g0v"
  ],
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://perdeu-playboy.online",
    siteName: "Perdeu, Playboy",
    title: "Perdeu, Playboy",
    description: "Painel publico de indicadores oficiais de violencia e seguranca publica nos 26 estados e no Distrito Federal, com series historicas, mapas, rankings e comparacoes por governo.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Perdeu, Playboy - painel publico de dados sobre violencia e seguranca publica"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Perdeu, Playboy",
    description: "Painel publico de indicadores oficiais de violencia e seguranca publica nos 26 estados e no Distrito Federal, com series historicas, mapas, rankings e comparacoes por governo.",
    images: ["/og-image.png"]
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${robotoMono.variable} ${bebasNeue.variable}`}>
      <body className="bg-background text-foreground font-sans selection:bg-accent-red selection:text-foreground">
        <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex items-center justify-between gap-4 py-3 sm:py-4">
              <Link href="/dashboard" className="group flex items-center gap-3">
                <Image
                  src="/logo_perdeu-playboy.png"
                  alt="Perdeu, Playboy"
                  width={56}
                  height={56}
                  priority
                  className="h-10 w-10 shrink-0 object-contain sm:h-11 sm:w-11"
                />
                <span className="flex flex-col leading-none">
                  <span className="font-display text-2xl tracking-wide text-foreground transition-colors group-hover:text-accent-red sm:text-[1.75rem]">
                    Perdeu, Playboy
                  </span>
                  <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
                    Segurança pública · dados oficiais
                  </span>
                </span>
              </Link>
              <UfSelector />
            </div>
          </div>
          <div className="border-t border-border">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <SiteNav />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-7 md:py-12">{children}</main>
        <footer className="border-t border-border bg-surface mt-12 py-8">
          <div className="mx-auto max-w-7xl px-4 text-center">
            <p className="font-mono text-xs text-muted">
              dados públicos ✦ g0v brazil & tomoyo ✦{" "}
              <a href="https://x.com/333tomoyo" className="text-foreground underline decoration-border underline-offset-4 hover:text-accent-red">
                X
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
