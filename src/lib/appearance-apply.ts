// FASE 3 — Aplicación de la apariencia al DOM (solo cliente).
import {
  mergeAppearance,
  FONT_VAR,
  DENSITY_GAP,
  CARD_WIDTH,
  SIDEBAR_WIDTH,
  type ThemeMode,
  type AppearanceParams,
  type Density,
} from "@/lib/appearance";

export type ResolvedTheme = "light" | "dark" | "pos";

export function resolveTheme(theme: ThemeMode): ResolvedTheme {
  if (theme === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function oklch(lightness: number, chroma: number, hue: number, alpha?: number): string {
  const h = ` ${hue}`;
  return alpha === undefined ? `oklch(${lightness} ${chroma} ${h})` : `oklch(${lightness} ${chroma} ${h} / ${alpha})`;
}

/** Calcula el valor efectivo y lo escribe como CSS custom properties (+ clases). */
export function applyAppearanceToDom(
  theme: ThemeMode,
  tenant: Partial<AppearanceParams> | null,
  overrides: Partial<AppearanceParams> | undefined
): void {
  if (typeof document === "undefined") return;

  const resolved = resolveTheme(theme);
  const effective = mergeAppearance(tenant, overrides);
  const isDark = resolved === "dark" || resolved === "pos";
  const density: Density = resolved === "pos" ? "compact" : effective.density;

  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
  root.setAttribute("data-theme", resolved);

  const css = root.style;
  const hue = effective.primaryHue;
  const acc = effective.accentHue;

  if (isDark) {
    css.setProperty("--primary", oklch(0.68, 0.14, hue));
    css.setProperty("--primary-foreground", "oklch(0.16 0 0)");
    css.setProperty("--ring", oklch(0.68, 0.14, hue, 0.4));
    css.setProperty("--accent", oklch(0.3, 0.06, acc));
    css.setProperty("--accent-foreground", oklch(0.95, 0.04, acc));
    css.setProperty("--sidebar-primary", oklch(0.68, 0.14, hue));
    css.setProperty("--sidebar-primary-foreground", "oklch(0.16 0 0)");
    css.setProperty("--sidebar-ring", oklch(0.68, 0.14, hue, 0.4));
  } else {
    css.setProperty("--primary", oklch(0.55, 0.14, hue));
    css.setProperty("--primary-foreground", "oklch(0.99 0 0)");
    css.setProperty("--ring", oklch(0.55, 0.14, hue, 0.4));
    css.setProperty("--accent", oklch(0.95, 0.04, acc));
    css.setProperty("--accent-foreground", oklch(0.3, 0.08, acc));
    css.setProperty("--sidebar-primary", oklch(0.55, 0.14, hue));
    css.setProperty("--sidebar-primary-foreground", "oklch(0.99 0 0)");
    css.setProperty("--sidebar-ring", oklch(0.55, 0.14, hue, 0.4));
  }

  css.setProperty("--primary-hue", String(hue));
  css.setProperty("--accent-hue", String(acc));
  css.setProperty("--font-family", FONT_VAR[effective.fontFamily]);
  css.setProperty("--font-scale", String(effective.fontScale));
  css.setProperty("--density-gap", DENSITY_GAP[density]);
  css.setProperty("--card-min-width", CARD_WIDTH[effective.cardSize]);
  css.setProperty("--card-max-width", CARD_WIDTH[effective.cardSize]);
  css.setProperty("--sidebar-width", SIDEBAR_WIDTH[effective.sidebarStyle]);
  css.setProperty("--radius", `${Math.min(Math.max(effective.borderRadius, 0), 2)}rem`);

  root.setAttribute(
    "data-appearance",
    JSON.stringify({ ...effective, density })
  );
}