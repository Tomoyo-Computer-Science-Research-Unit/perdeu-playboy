"use client";

import { useEffect, useState } from "react";
import { enabledUf, ufOptions, type UfCode } from "@/lib/ufs";

export function UfSelector() {
  const [uf, setUf] = useState<UfCode>("BR");

  useEffect(() => {
    function handleUfChange(event: Event) {
      const detail = (event as CustomEvent<{ uf?: string }>).detail;
      setUf(enabledUf(detail?.uf));
    }

    window.addEventListener("ufchange", handleUfChange);
    const params = new URLSearchParams(window.location.search);
    const nextUf = enabledUf(params.get("uf") ?? window.localStorage.getItem("selected_uf"));
    setUf(nextUf);
    window.localStorage.setItem("selected_uf", nextUf);
    window.dispatchEvent(new CustomEvent("ufchange", { detail: { uf: nextUf } }));
    return () => window.removeEventListener("ufchange", handleUfChange);
  }, []);

  function changeUf(nextUf: UfCode) {
    setUf(nextUf);
    window.localStorage.setItem("selected_uf", nextUf);
    const params = new URLSearchParams(window.location.search);
    params.set("uf", nextUf);
    const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
    window.dispatchEvent(new CustomEvent("ufchange", { detail: { uf: nextUf } }));
  }

  return (
    <label className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-muted">
      UF
      <select
        aria-label="Selecionar UF"
        value={uf}
        onChange={(event) => changeUf(event.target.value as UfCode)}
        className="h-9 border border-border bg-background px-2 text-xs text-foreground"
      >
        {ufOptions.map((option) => (
          <option key={option.code} value={option.code} disabled={!option.enabled}>
            {option.code}
            {option.status === "integration" ? " - em integracao" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
