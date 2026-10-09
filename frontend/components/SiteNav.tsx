"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Panorama", sub: "resumo" },
  { href: "/trends", label: "Séries", sub: "desde 1991" },
  { href: "/map", label: "Mapa", sub: "municípios e bairros" },
  { href: "/rankings", label: "Rankings", sub: "territórios" },
  { href: "/changes", label: "Mudanças", sub: "últimos 12 meses" },
  { href: "/governors", label: "Mandatos", sub: "governadores" },
  { href: "/methodology", label: "Método", sub: "fontes e glossário" }
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Seções" className="-mx-[var(--gutter)] border-y border-line sm:mx-0">
      <ul className="flex overflow-x-auto px-[var(--gutter)] sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-[58px] flex-col items-center justify-center px-4 text-[12px] font-medium tracking-[0.14em] transition-colors sm:px-5 ${
                  active ? "text-ink" : "text-slate hover:text-ink"
                }`}
              >
                {item.label}
                <small className="serif mt-0.5 hidden text-[10.5px] italic tracking-[0.06em] text-smoke md:block">{item.sub}</small>
                <span aria-hidden="true" className={`absolute inset-x-4 bottom-0 h-px ${active ? "bg-ink" : "bg-transparent"}`} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
