import type { Metadata } from "next";
import { Inter, Roboto_Mono, Bebas_Neue } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { UfSelector } from "@/components/UfSelector";
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
  description: "Painel publico de indicadores oficiais de violencia e seguranca publica no Rio de Janeiro, Sao Paulo, Parana e Santa Catarina.",
  applicationName: "Perdeu, Playboy",
  authors: [{ name: "g0v brazil & tomoyo", url: "https://x.com/333tomoyo" }],
  creator: "g0v brazil & tomoyo",
  publisher: "g0v brazil & tomoyo",
  keywords: [
    "Rio de Janeiro",
    "Sao Paulo",
    "Parana",
    "Santa Catarina",
    "seguranca publica",
    "ISP Dados Abertos",
    "SSP-SP",
    "Sinesp",
    "violencia",
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
    description: "Painel publico de indicadores oficiais de violencia e seguranca publica no Rio de Janeiro, Sao Paulo, Parana e Santa Catarina.",
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
    description: "Painel publico de indicadores oficiais de violencia e seguranca publica no Rio de Janeiro, Sao Paulo, Parana e Santa Catarina.",
    images: ["/og-image.png"]
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png"
  }
};

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/trends", label: "Tendências" },
  { href: "/map", label: "Mapa" },
  { href: "/rankings", label: "Rankings" },
  { href: "/changes", label: "Mudanças" },
  { href: "/governors", label: "Governadores" },
  { href: "/sources", label: "Fontes" },
  { href: "/glossary", label: "Glossário" },
  { href: "/methodology", label: "Metodologia" }
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${robotoMono.variable} ${bebasNeue.variable}`}>
      <body className="bg-background text-foreground font-sans selection:bg-foreground selection:text-background">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:py-5 md:flex-row md:items-end md:justify-between border-l-4 border-border">
            <Link href="/dashboard" className="group flex items-center gap-3">
              <Image
                src="/logo_perdeu-playboy.png"
                alt="Perdeu, Playboy"
                width={56}
                height={56}
                priority
                className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
              />
              <h1 className="text-3xl font-display text-foreground m-0 leading-none sm:text-4xl">Perdeu, Playboy</h1>
            </Link>
            <div className="flex flex-col gap-3 md:items-end">
              <UfSelector />
              <nav className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 pb-1 font-mono text-[11px] uppercase tracking-wider text-muted sm:flex-wrap sm:text-xs md:justify-end">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className="shrink-0 px-3 py-2 border border-transparent hover:border-border hover:bg-background hover:text-foreground transition-all">
                    [{item.label}]
                  </Link>
                ))}
              </nav>
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
