import { prisma } from "@/lib/db";
import type { AppSettings } from "@prisma/client";

// FASE 3 — lectura/escritura de app_settings por organización.

export type AppSettingsParams = {
  theme: string;
  primaryHue: number;
  accentHue: number;
  fontFamily: string;
  fontScale: number;
  density: string;
  borderRadius: number;
  cardSize: string;
  sidebarStyle: string;
};

export const DEFAULT_APP_SETTINGS: AppSettingsParams = {
  theme: "system",
  primaryHue: 210,
  accentHue: 150,
  fontFamily: "montserrat",
  fontScale: 1,
  density: "comfortable",
  borderRadius: 0.75,
  cardSize: "md",
  sidebarStyle: "full",
};

export function serializeSettings(
  s: Pick<
    AppSettings,
    | "theme"
    | "primaryHue"
    | "accentHue"
    | "fontFamily"
    | "fontScale"
    | "density"
    | "borderRadius"
    | "cardSize"
    | "sidebarStyle"
  >
): AppSettingsParams {
  return {
    theme: s.theme,
    primaryHue: s.primaryHue,
    accentHue: s.accentHue,
    fontFamily: s.fontFamily,
    fontScale: Number(s.fontScale),
    density: s.density,
    borderRadius: Number(s.borderRadius),
    cardSize: s.cardSize,
    sidebarStyle: s.sidebarStyle,
  };
}

export async function getAppSettings(
  organizationId: string
): Promise<AppSettingsParams | null> {
  const s = await prisma.appSettings.findUnique({ where: { organizationId } });
  return s ? serializeSettings(s) : null;
}

export async function upsertAppSettings(
  organizationId: string,
  patch: Partial<AppSettingsParams>
): Promise<AppSettingsParams> {
  const existing = await prisma.appSettings.findUnique({ where: { organizationId } });
  if (existing) {
    const updated = await prisma.appSettings.update({ where: { id: existing.id }, data: patch });
    return serializeSettings(updated);
  }
  const created = await prisma.appSettings.create({
    data: { organizationId, ...DEFAULT_APP_SETTINGS, ...patch },
  });
  return serializeSettings(created);
}