"use client";

import { usePathname, useRouter } from "next/navigation";
import { PUBLISHED_UFS, switchUfHref } from "@/lib/uf";
import { useUf } from "@/lib/use-uf";

/** Próxima UF da lista publicada, para a tecla U. */
export function nextUf(code: string): string {
  const index = PUBLISHED_UFS.findIndex((entry) => entry.code === code);
  return PUBLISHED_UFS[(index + 1) % PUBLISHED_UFS.length].code;
}

/** Vai para a mesma tela em outra UF (sem a query, que pode citar município de outra UF). */
export function UfSelector() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const uf = useUf();
  if (PUBLISHED_UFS.length < 2) {
    return null;
  }
  return (
    <select
      className="yearselect"
      aria-label="Unidade da federação"
      title="Unidade da federação (U)"
      value={uf.code}
      onChange={(event) => router.push(switchUfHref(event.target.value, pathname))}
    >
      {PUBLISHED_UFS.map((entry) => (
        <option key={entry.code} value={entry.code}>
          {entry.name}
        </option>
      ))}
    </select>
  );
}
