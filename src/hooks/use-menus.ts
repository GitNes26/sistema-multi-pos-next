"use client";

import { useEffect, useState } from "react";
import {
  menuTreeToBottomItems,
  menuTreeToSections,
  type NavItem,
  type NavSection,
} from "@/lib/nav";
import type { MenuNode } from "@/lib/menus/server";

// FASE 14.5/14.7 — Carga el árbol de menú desde la BD (filtrado por permisos
// en el servidor) y lo convierte a secciones/items para la navegación.

export function useMenus() {
  const [sections, setSections] = useState<NavSection[] | null>(null);
  const [bottomItems, setBottomItems] = useState<NavItem[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/menus", { headers: { "Content-Type": "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok?: boolean; menu?: MenuNode[] } | null) => {
        if (!active || !data?.ok || !data.menu) return;
        setSections(menuTreeToSections(data.menu));
        setBottomItems(menuTreeToBottomItems(data.menu));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return { sections, bottomItems };
}
