"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { loadCore, setCore, type Snapshot } from "@/lib/static-api";
import { useUf } from "@/lib/use-uf";

type Loaded = { code: string; core: Snapshot };
const listeners = new Set<(loaded: Loaded) => void>();
let lastLoaded: Loaded | null = null;

/**
 * Carrega o núcleo de dados da UF da página e só então renderiza a tela. As telas leem o núcleo
 * pelos getters de lib/static-api, de forma síncrona; trocar de UF remonta a tela (key).
 */
export function DataGate({ children }: { children: ReactNode }) {
  const uf = useUf();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    loadCore(uf.code)
      .then((core) => {
        if (alive) {
          const next = { code: uf.code, core };
          setCore(uf.code, core);
          lastLoaded = next;
          setLoaded(next);
          listeners.forEach((listener) => listener(next));
        }
      })
      .catch((reason: unknown) => {
        if (alive) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });
    return () => {
      alive = false;
    };
  }, [uf.code]);

  if (!loaded || loaded.code !== uf.code) {
    return (
      <div className="grid h-full place-items-center text-[11px] tracking-[0.22em] text-ash" role="status" aria-live="polite">
        {error ? `DADOS INDISPONÍVEIS · ${error}` : "CARREGANDO"}
      </div>
    );
  }
  setCore(loaded.code, loaded.core);
  return <Fragment key={loaded.code}>{children}</Fragment>;
}

/** Núcleo carregado mais recente, para o que fica fora de DataGate (rodapé). */
export function useLoadedCore(): Loaded | null {
  const [loaded, setLoaded] = useState<Loaded | null>(lastLoaded);
  useEffect(() => {
    listeners.add(setLoaded);
    if (lastLoaded) {
      setLoaded(lastLoaded);
    }
    return () => {
      listeners.delete(setLoaded);
    };
  }, []);
  return loaded;
}
