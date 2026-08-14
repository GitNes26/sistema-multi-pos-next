"use client";

import { useCallback } from "react";
import { usePosStore } from "@/stores/pos-store";

/**
 * Refresca el catálogo/sesión desde el server para reflejar inventario y
 * estado de caja tras una venta o un movimiento de caja.
 */
export function usePosRefresh() {
  const setCatalog = usePosStore((s) => s.setCatalog);

  return useCallback(async () => {
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}