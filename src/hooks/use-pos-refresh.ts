"use client";

import { useCallback, useRef } from "react";
import { usePosStore } from "@/stores/pos-store";

/**
 * Refresca el catálogo/sesión desde el server para reflejar inventario y
 * estado de caja tras una venta o un movimiento de caja.
 */
export function usePosRefresh() {
  const setCatalog = usePosStore((s) => s.setCatalog);
  const pending = useRef<Promise<unknown> | null>(null);

  return useCallback(async () => {
    if (pending.current) return pending.current;
    const request = (async () => {
    try {
      const res = await fetch("/api/pos/catalog", { cache: "no-store" });
      const data = await res.json();
      if (data.ok && data.catalog) {
        setCatalog(data.catalog);
        return data.catalog;
      }
      return null;
    } catch {
      return null;
    } finally {
      pending.current = null;
    }
    })();
    pending.current = request;
    return request;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
