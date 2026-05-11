import type { Metadata } from "next";
import { Inter, Roboto_Mono, Bebas_Neue } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const robotoMono = Roboto_Mono({ subsets: ["latin"], variable: "--font-roboto-mono" });
const bebasNeue = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas-neue" });

export const metadata: Metadata = {
  title: "Perdeu, Playboy",
  description: "Painel público de indicadores oficiais de violência e segurança pública no RJ.",
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
  { href: "/governors", label: "Governadores" },
  { href: "/methodology", label: "Metodologia" }
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${robotoMono.variable} ${bebasNeue.variable}`}>
      <body className="bg-background text-foreground font-sans selection:bg-foreground selection:text-background">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 md:flex-row md:items-end md:justify-between border-l-4 border-border">
            <Link href="/dashboard" className="group flex items-center gap-3">
              <Image
                src="/logo_perdeu-playboy.png"
                alt="Perdeu, Playboy"
                width={56}
                height={56}
                priority
                className="h-14 w-14 shrink-0 object-contain"
              />
              <h1 className="text-4xl font-display text-foreground m-0 leading-none">Perdeu, Playboy</h1>
            </Link>
            <nav className="flex flex-wrap gap-1 font-mono text-xs uppercase tracking-wider text-muted">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="px-3 py-2 border border-transparent hover:border-border hover:bg-background hover:text-foreground transition-all">
                  [{item.label}]
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 md:py-12">{children}</main>
        <footer className="border-t border-border bg-surface mt-12 py-8">
          <div className="mx-auto max-w-7xl px-4 text-center">
            <p className="font-mono text-xs text-muted">
              dados públicos ✦ g0v brazil & tomoyo ✦{" "}
              <a href="https://jovens-turcos.nya.pub/" className="text-foreground underline decoration-border underline-offset-4 hover:text-accent-red">
                fórum
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
