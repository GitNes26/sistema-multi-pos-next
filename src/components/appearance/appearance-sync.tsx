"use client";

import { useEffect, useRef } from "react";
import { useThemeStore } from "@/stores/theme-store";
import type { AppSettingsParams } from "@/lib/db/app-settings";
import type { ThemeMode } from "@/lib/appearance";

const THEMES = ["system", "light", "dark", "pos"] as const;

// FASE 3.1/3.7 — Carga los app_settings de la organización en el store
// (solo memoria); el ThemeProvider ya aplica la mezcla en vivo.
export function AppearanceSync({ tenant }: { tenant: AppSettingsParams | null }) {
  const setTenant = useThemeStore((s) => s.setTenant);
  const setTheme = useThemeStore((s) => s.setTheme);
  const lastAppliedRef = useRef<string>("");

  useEffect(() => {
    if (!tenant) {
      setTenant(null);
      return;
    }

    // Create a fingerprint to avoid re-applying the same values
    const fingerprint = JSON.stringify(tenant);
    if (fingerprint === lastAppliedRef.current) return;
    lastAppliedRef.current = fingerprint;

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

    // Sync theme mode from DB if valid
    if (tenant.theme && (THEMES as readonly string[]).includes(tenant.theme)) {
      setTheme(tenant.theme as ThemeMode);
    }
  }, [tenant, setTenant, setTheme]);

  return null;
}