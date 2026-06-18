"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/trends", label: "Tendências" },
  { href: "/map", label: "Mapa" },
  { href: "/rankings", label: "Rankings" },
  { href: "/changes", label: "Mudanças" },
  { href: "/governors", label: "Mandatos" },
  { href: "/sources", label: "Fontes" },
  { href: "/glossary", label: "Glossário" },
  { href: "/methodology", label: "Metodologia" }
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Seções" className="-mx-4 sm:mx-0">
      <ul className="flex overflow-x-auto px-4 font-mono text-[11px] uppercase tracking-[0.18em] sm:px-0 sm:text-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative block px-3 py-3 transition-colors duration-150 ${
                  active ? "text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {item.label}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-3 bottom-0 h-[2px] transition-colors duration-150 ${
                    active ? "bg-accent-red" : "bg-transparent"
                  }`}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
