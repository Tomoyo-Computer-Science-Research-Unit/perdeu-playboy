"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_ITEMS = [
  { href: "/", label: "Panorama", key: "1" },
  { href: "/series", label: "Séries", key: "2" },
  { href: "/mapa", label: "Mapa", key: "3" },
  { href: "/rankings", label: "Rankings", key: "4" },
  { href: "/mudancas", label: "Mudanças", key: "5" },
  { href: "/mandatos", label: "Mandatos", key: "6" },
  { href: "/metodologia", label: "Método", key: "7" }
];

export function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  if (href === "/metodologia") {
    return ["/metodologia", "/glossario", "/fontes"].some((path) => pathname.startsWith(path));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Seções" className="min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex items-center">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-12 items-center gap-1.5 px-2.5 text-[10.5px] font-medium uppercase tracking-[0.14em] transition-colors xl:px-3 xl:text-[11px] ${
                  active ? "text-ink shadow-[inset_0_-1px_0_var(--ink)]" : "text-slate hover:text-ink"
                }`}
              >
                <span className="kbd">{item.key}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
