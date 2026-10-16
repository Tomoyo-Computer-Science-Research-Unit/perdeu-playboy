"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { configFor, screenFromPath, ufHref, type UfEntry } from "@/lib/uf";
import { useUf } from "@/lib/use-uf";

// Tiroteios só existe onde há fonte (Fogo Cruzado cobre o Rio); as teclas seguem a ordem da lista.
export function navItems(uf: UfEntry) {
  return [
    { href: "/", label: "Panorama" },
    { href: "/series", label: "Séries" },
    { href: "/mapa", label: "Mapa" },
    { href: "/rankings", label: "Rankings" },
    { href: "/mudancas", label: "Mudanças" },
    { href: "/mandatos", label: "Mandatos" },
    ...(configFor(uf).hasShootings ? [{ href: "/tiroteios", label: "Tiroteios" }] : []),
    { href: "/metodologia", label: "Método" }
  ].map((item, index) => ({ ...item, key: String(index + 1) }));
}

export function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  if (href === "/metodologia") {
    return ["/metodologia", "/glossario", "/fontes", "/status"].some((path) => pathname.startsWith(path));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const pathname = screenFromPath(usePathname());
  const uf = useUf();

  return (
    <nav aria-label="Seções" className="min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex items-center">
        {navItems(uf).map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={ufHref(uf.code, item.href)}
                aria-current={active ? "page" : undefined}
                className={`flex h-12 items-center gap-1.5 px-[7px] text-[10.5px] font-medium uppercase tracking-[0.06em] transition-colors ${
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
