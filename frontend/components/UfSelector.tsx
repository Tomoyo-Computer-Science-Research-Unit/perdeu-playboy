"use client";

import { usePathname } from "next/navigation";
import { PUBLISHED_UFS, UF, ufHref } from "@/lib/uf";

/** Vai para a mesma tela em outra UF (cada UF é um build com basePath próprio, então é navegação inteira). */
export function goToUf(code: string, pathname: string) {
  window.location.assign(ufHref(code, pathname));
}

/** Próxima UF da lista publicada, para a tecla U. */
export function nextUf(): string {
  const index = PUBLISHED_UFS.findIndex((entry) => entry.code === UF);
  return PUBLISHED_UFS[(index + 1) % PUBLISHED_UFS.length].code;
}

export function UfSelector() {
  const pathname = usePathname() ?? "/";
  if (PUBLISHED_UFS.length < 2) {
    return null;
  }
  return (
    <select
      className="yearselect"
      aria-label="Unidade da federação"
      title="Unidade da federação (U)"
      value={UF}
      onChange={(event) => goToUf(event.target.value, pathname)}
    >
      {PUBLISHED_UFS.map((entry) => (
        <option key={entry.code} value={entry.code}>
          {entry.name}
        </option>
      ))}
    </select>
  );
}
