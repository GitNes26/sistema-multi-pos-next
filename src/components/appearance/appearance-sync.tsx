"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/stores/theme-store";
import type { AppSettingsParams } from "@/lib/db/app-settings";

// FASE 3.1/3.7 — Carga los app_settings de la organización en el store
// (solo memoria); el ThemeProvider ya aplica la mezcla en vivo.
export function AppearanceSync({ tenant }: { tenant: AppSettingsParams | null }) {
  const setTenant = useThemeStore((s) => s.setTenant);

  useEffect(() => {
    if (!tenant) {
      setTenant(null);
      return;
    }
    setTenant({
      primaryHue: tenant.primaryHue,
      accentHue: tenant.accentHue,
      fontFamily: tenant.fontFamily as never,
      fontScale: tenant.fontScale,
      density: tenant.density as never,
      borderRadius: tenant.borderRadius,
      cardSize: tenant.cardSize as never,
      sidebarStyle: tenant.sidebarStyle as never,
    });
  }, [tenant, setTenant]);

  return null;
}