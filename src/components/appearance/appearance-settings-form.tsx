"use client";

import { useState } from "react";
import { useThemeStore } from "@/stores/theme-store";
import {
  mergeAppearance,
  THEMES,
  DENSITIES,
  CARD_SIZES,
  FONT_FAMILIES,
  SIDEBAR_STYLES,
  type ThemeMode,
  type Density,
  type CardSize,
  type FontFamily,
  type SidebarStyle,
} from "@/lib/appearance";
import { DEFAULT_APP_SETTINGS } from "@/lib/db/app-settings";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Check, Loader2, Monitor, Moon, Palette, Save, Sun, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const THEME_LABELS: Record<ThemeMode, { label: string; icon: React.ReactNode }> = {
  system: { label: "Sistema", icon: <Monitor /> },
  light: { label: "Claro", icon: <Sun /> },
  dark: { label: "Oscuro", icon: <Moon /> },
  pos: { label: "POS", icon: <Zap /> },
};

const DENSITY_LABELS: Record<Density, string> = {
  compact: "Compacto",
  comfortable: "Cómodo",
  spacious: "Espacioso",
};

const CARD_LABELS: Record<CardSize, string> = {
  sm: "Pequeñas",
  md: "Medianas",
  lg: "Grandes",
};

const FONT_LABELS: Record<FontFamily, string> = {
  montserrat: "Montserrat",
  poppins: "Poppins",
  system: "Sistema",
};

const SIDEBAR_LABELS: Record<SidebarStyle, string> = {
  full: "Completa",
  compact: "Compacta",
  icon: "Iconos",
};

function Swatch({ hue }: { hue: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="size-5 rounded-md border"
        style={{ background: `oklch(0.55 0.14 ${hue})` }}
      />
      <span className="font-mono text-xs text-muted-foreground">{hue}°</span>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  labels,
  onChange,
}: {
  value: T;
  options: readonly T[];
  labels: Record<T, string> | Record<T, { label: string; icon: React.ReactNode }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const item = labels[opt];
        const isString = typeof item === "string";
        const label = isString ? (item as string) : (item as { label: string }).label;
        const icon = !isString ? (item as { icon: React.ReactNode }).icon : null;
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {icon}
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function AppearanceSettingsForm() {
  const theme = useThemeStore((s) => s.theme);
  const tenant = useThemeStore((s) => s.tenant);
  const overrides = useThemeStore((s) => s.overrides);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setOverride = useThemeStore((s) => s.setAppearanceOverride);
  const resetOverrides = useThemeStore((s) => s.resetAppearanceOverrides);
  const setTenant = useThemeStore((s) => s.setTenant);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const appearance = mergeAppearance(tenant, overrides);

  function applyLocal(patch: Partial<typeof appearance>) {
    setOverride(patch);
  }

  async function saveForCompany() {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/settings/appearance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme, ...appearance }),
    });
    const data = (await res.json().catch(() => null)) as { settings?: typeof DEFAULT_APP_SETTINGS } | null;
    setSaving(false);
    if (!res.ok) return;
    setTenant({
      primaryHue: data!.settings!.primaryHue,
      accentHue: data!.settings!.accentHue,
      fontFamily: data!.settings!.fontFamily as never,
      fontScale: data!.settings!.fontScale,
      density: data!.settings!.density as never,
      borderRadius: data!.settings!.borderRadius,
      cardSize: data!.settings!.cardSize as never,
      sidebarStyle: data!.settings!.sidebarStyle as never,
    });
    resetOverrides();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function resetCompany() {
    setSaving(true);
    const res = await fetch("/api/settings/appearance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(DEFAULT_APP_SETTINGS),
    });
    setSaving(false);
    if (!res.ok) return;
    setTenant({ ...DEFAULT_APP_SETTINGS } as never);
    resetOverrides();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Apariencia</h1>
          <p className="text-sm text-muted-foreground">
            Tema y estilo del sistema para toda la empresa. Los cambios se aplican al instante.
          </p>
        </div>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm text-primary">
            <Check /> Guardado
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="size-4" /> Tema
          </CardTitle>
          <CardDescription>
            Claro, oscuro, POS (dark de alta densidad) o siguiendo el sistema del dispositivo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Segmented value={theme} options={THEMES} labels={THEME_LABELS} onChange={setTheme} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="size-4" /> Colores
          </CardTitle>
          <CardDescription>
            El tono primario para botones/acciones y el de acento para resaltados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label3 helper="Verde, azul, naranja…">Color primario</Label3>
              <Swatch hue={appearance.primaryHue} />
            </div>
            <Slider
              min={0}
              max={360}
              step={1}
              value={[appearance.primaryHue]}
              onValueChange={(v) => applyLocal({ primaryHue: v[0] })}
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label3 helper="Usado en acentos y estados seleccionados">Color de acento</Label3>
              <Swatch hue={appearance.accentHue} />
            </div>
            <Slider
              min={0}
              max={360}
              step={1}
              value={[appearance.accentHue]}
              onValueChange={(v) => applyLocal({ accentHue: v[0] })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipografía y escala</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label3>Tipografía</Label3>
            <Segmented
              value={appearance.fontFamily}
              options={FONT_FAMILIES}
              labels={FONT_LABELS}
              onChange={(v) => applyLocal({ fontFamily: v })}
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label3>Escala de texto</Label3>
              <span className="font-mono text-xs text-muted-foreground">
                {appearance.fontScale.toFixed(2)}×
              </span>
            </div>
            <Slider
              min={0.85}
              max={1.3}
              step={0.05}
              value={[appearance.fontScale]}
              onValueChange={(v) => applyLocal({ fontScale: Number(v[0].toFixed(2)) })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Espacio y densidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label3>Densidad</Label3>
            <Segmented
              value={appearance.density}
              options={DENSITIES}
              labels={DENSITY_LABELS}
              onChange={(v) => applyLocal({ density: v })}
            />
          </div>
          <div className="space-y-3">
            <Label3>Radio de bordes</Label3>
            <div className="flex items-center gap-3">
              <Slider
                min={0}
                max={2}
                step={0.125}
                value={[appearance.borderRadius]}
                onValueChange={(v) => applyLocal({ borderRadius: v[0] })}
              />
              <span className="font-mono text-xs text-muted-foreground w-10 text-right">
                {appearance.borderRadius.toFixed(2)}rem
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarjetas y navegación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label3>Tamaño de tarjetas de catálogo</Label3>
            <Segmented
              value={appearance.cardSize}
              options={CARD_SIZES}
              labels={CARD_LABELS}
              onChange={(v) => applyLocal({ cardSize: v })}
            />
          </div>
          <div className="space-y-3">
            <Label3>Estilo de barra lateral</Label3>
            <Segmented
              value={appearance.sidebarStyle}
              options={SIDEBAR_STYLES}
              labels={SIDEBAR_LABELS}
              onChange={(v) => applyLocal({ sidebarStyle: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void saveForCompany()} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          Guardar para la empresa
        </Button>
        <Button variant="outline" onClick={() => void resetCompany()} disabled={saving}>
          Restablecer valores de la empresa
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Los cambios se guardan también en este dispositivo en tiempo real (preferencias locales en
        localStorage, sincronizadas entre pestañas).
      </p>
    </div>
  );
}

function Label3({ children, helper }: { children: React.ReactNode; helper?: string }) {
  return (
    <div>
      <p className="text-sm font-medium">{children}</p>
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}