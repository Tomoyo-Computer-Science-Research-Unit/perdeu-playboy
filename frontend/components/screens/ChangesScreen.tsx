"use client";

import { useEffect, useState } from "react";
import { ChangesExplorer } from "@/components/ChangesExplorer";
import { getLatestChanges } from "@/lib/api";
import type { LatestChangesResponse } from "@/types/api";

export function ChangesScreen() {
  const [changes, setChanges] = useState<LatestChangesResponse | null>(null);
  useEffect(() => {
    let alive = true;
    getLatestChanges().then((next) => {
      if (alive) {
        setChanges(next);
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!changes) {
    return <div className="grid h-full place-items-center text-[11px] tracking-[0.22em] text-ash">CARREGANDO</div>;
  }
  return <ChangesExplorer sections={changes.sections} latest={changes.latest_period} />;
}
