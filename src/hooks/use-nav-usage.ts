"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { recordVisit, type NavUsageStore } from "@/lib/nav-usage";

const KEY = "mp.nav.usage";
// Con el menú montado dos veces (barra fija y cajón móvil) cada visita se cuenta una sola vez.
let lastRecorded = "";

function read(storageKey: string): NavUsageStore {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as NavUsageStore) : {};
  } catch {
    return {};
  }
}

/**
 * Historial de uso del menú de esta persona en este equipo. `store` es una foto tomada al
 * abrir (el menú no se reacomoda mientras navegas); `visit` guarda la visita para la próxima vez.
 */
export function useNavUsage() {
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? "anon";
  const storageKey = `${KEY}.${userId}`;
  const [store, setStore] = React.useState<NavUsageStore>({});
  React.useEffect(() => {
    setStore(read(storageKey));
  }, [storageKey]);

  const visit = React.useCallback(
    (navKey: string) => {
      const marker = `${storageKey}|${navKey}`;
      if (lastRecorded === marker) return;
      lastRecorded = marker;
      try {
        localStorage.setItem(storageKey, JSON.stringify(recordVisit(read(storageKey), navKey, Date.now())));
      } catch {
        /* almacenamiento no disponible: el menú usa el orden por defecto */
      }
    },
    [storageKey]
  );
  return { store, visit };
}
