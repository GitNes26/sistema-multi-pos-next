"use client";

import { useState, useCallback } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Car,
  Check,
  Coins,
  Layers,
  Loader2,
  Store,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  BUSINESS_MODE_LIST,
  type BusinessModeInfo,
} from "@/lib/business-modes";
import type { BusinessMode } from "@/lib/auth/options";

/* ------------------------------------------------------------------ */
/*  Steps                                                              */
/* ------------------------------------------------------------------ */

const STEPS = [
  { id: "welcome", label: "Bienvenida" },
  { id: "business", label: "Tipo de negocio" },
  { id: "done", label: "¡Listo!" },
];

/* ------------------------------------------------------------------ */
/*  Onboarding Wizard                                                  */
/* ------------------------------------------------------------------ */
// La organización ya fue creada por el superAdmin (nombre + moneda) y la
// cuenta del propietario ya existe (nombre, email y contraseña). Este wizard
// solo define el tipo de negocio — el resto se hace con las guías del panel.

interface OnboardingWizardProps {
  orgId?: string;
  orgName?: string;
  orgCurrency?: string;
  currentMode?: BusinessMode | null;
}

export function OnboardingWizard({
  orgId,
  orgName,
  orgCurrency = "MXN",
  currentMode = null,
}: OnboardingWizardProps) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<string>(
    currentMode ?? ""
  );

  const selectedModeData = BUSINESS_MODE_LIST.find(
    (m) => m.id === selectedMode
  );

  const canNext = useCallback(() => {
    switch (step) {
      case 0:
        return true; // Welcome always can advance
      case 1:
        return !!selectedMode; // Must select a mode
      case 2:
        return true; // Done always can finish
      default:
        return false;
    }
  }, [step, selectedMode]);

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  }, [step]);

  const handleBack = useCallback(() => {
    if (step > 0) setStep((s) => s - 1);
    else router.push("/admin");
  }, [step, router]);

  const handleFinish = useCallback(async () => {
    if (!selectedMode) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessMode: selectedMode }),
      });
      const data = await res.json().catch(() => null);
      if (data?.ok) {
        // Refresh the session JWT so businessMode (y la org, en el flujo de
        // auto-registro) queden actualizados en la sesión. Se pasa el orgId
        // explícito: el callback jwt solo re-lee businessMode cuando recibe
        // activeOrganizationId en el payload de update.
        const nextOrgId = (data.organizationId as string | undefined) ?? orgId;
        await updateSession(nextOrgId ? { activeOrganizationId: nextOrgId } : {});
        router.push("/admin");
      } else {
        setError(data?.error || "No se pudo guardar el tipo de negocio");
      }
    } catch {
      setError("Error de conexión. Revisa tu red e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [selectedMode, orgId, router, updateSession]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Encabezado con progreso */}
      <header className="safe-area-top sticky top-0 z-10 border-b bg-background/90 supports-backdrop-filter:bg-background/75 supports-backdrop-filter:backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-5 py-4 sm:px-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Logo size={18} className="rounded-lg" />
              <span className="font-semibold tracking-tight">Configuración inicial</span>
            </div>
            <span className="text-xs font-medium text-muted-foreground tabular">
              Paso {step + 1} de {STEPS.length}
            </span>
          </div>
          <ol className="grid grid-cols-3 gap-2" aria-label="Progreso">
            {STEPS.map((s, i) => (
              <li key={s.id} aria-current={i === step ? "step" : undefined} className="space-y-1.5">
                <span className="relative block h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn(
                      "absolute inset-0 origin-left rounded-full bg-primary transition-transform duration-500 ease-(--ease-out-expo)",
                      i <= step ? "scale-x-100" : "scale-x-0"
                    )}
                  />
                </span>
                <span
                  className={cn(
                    "block text-xs transition-colors",
                    i === step ? "font-semibold text-foreground" : i < step ? "text-foreground/70" : "text-muted-foreground"
                  )}
                >
                  {s.label}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <div key={step} className="mx-auto w-full max-w-3xl animate-rise-in">
          {/* Paso 0: bienvenida */}
          {step === 0 && (
            <div className="max-w-xl space-y-8">
              <div className="space-y-4">
                <h1 className="font-heading text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
                  Bienvenido a Multi-POS
                </h1>
                <p className="text-lg text-muted-foreground">
                  Tu organización ya está creada. Solo falta elegir el tipo de
                  negocio para activar las herramientas correctas.
                </p>
              </div>

              <dl className="divide-y rounded-xl border bg-card">
                <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <dt className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Building2 className="size-4" /> Empresa
                  </dt>
                  <dd className="truncate text-sm font-semibold">{orgName || "Tu empresa"}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <dt className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Coins className="size-4" /> Moneda
                  </dt>
                  <dd className="text-sm font-semibold tabular">{orgCurrency}</dd>
                </div>
              </dl>
              <p className="text-sm text-muted-foreground">
                Nombre y moneda los definió tu administrador; puedes ajustarlos
                después en Ajustes.
              </p>
            </div>
          )}

          {/* Paso 1: tipo de negocio */}
          {step === 1 && (
            <div className="space-y-8">
              <div className="max-w-xl space-y-2">
                <h2 className="font-heading text-3xl font-semibold tracking-tight">
                  ¿Qué tipo de negocio operas?
                </h2>
                <p className="text-muted-foreground">
                  Define qué páginas, permisos y herramientas se activan. Puedes
                  cambiarlo después.
                </p>
              </div>

              <div role="radiogroup" aria-label="Tipo de negocio" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {BUSINESS_MODE_LIST.map((mode) => (
                  <ModeCard
                    key={mode.id}
                    mode={mode}
                    selected={selectedMode === mode.id}
                    onSelect={() => setSelectedMode(mode.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Paso 2: listo */}
          {step === 2 && (
            <div className="max-w-xl space-y-8">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-e2">
                <Check className="size-7" strokeWidth={2.5} />
              </span>
              <div className="space-y-3">
                <h2 className="font-heading text-4xl font-semibold tracking-tight">Todo listo</h2>
                <p className="text-lg text-muted-foreground">
                  <strong className="font-semibold text-foreground">{orgName || "Tu empresa"}</strong>{" "}
                  quedará configurada como{" "}
                  <strong className="font-semibold text-foreground">{selectedModeData?.label}</strong>.
                </p>
              </div>

              {selectedModeData && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Lo que se activa para ti</p>
                  <ul className="flex flex-wrap gap-2">
                    {selectedModeData.features.map((f) => (
                      <li
                        key={f}
                        className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
                      >
                        <Check className="size-3.5" /> {f}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-muted-foreground">
                    En el panel verás una guía paso a paso que te lleva a cada
                    apartado (productos, envíos, mesas…) para llenar los
                    formularios reales.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {error && (
        <div className="mx-auto w-full max-w-3xl px-5 pb-3 sm:px-8">
          <div
            role="alert"
            className="animate-rise-in rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        </div>
      )}

      {/* Navegación inferior fija: alcanzable con el pulgar */}
      <footer className="safe-area-bottom sticky bottom-0 border-t bg-background/90 supports-backdrop-filter:bg-background/75 supports-backdrop-filter:backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <Button
            variant="ghost"
            onClick={handleBack}
            aria-label={step === 0 ? "Volver al panel" : "Volver al paso anterior"}
          >
            <ArrowLeft className="size-4" />
            {step === 0 ? "Volver al panel" : "Atrás"}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button size="lg" onClick={handleNext} disabled={!canNext()} className="min-w-36">
              Continuar
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button size="lg" onClick={handleFinish} disabled={loading} className="min-w-36">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Configurando…
                </>
              ) : (
                <>
                  Ir al panel
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mode card                                                          */
/* ------------------------------------------------------------------ */

function ModeCard({
  mode,
  selected,
  onSelect,
}: {
  mode: BusinessModeInfo;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon: LucideIcon = modeIcon(mode.id);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "press group relative flex flex-col rounded-2xl border bg-card p-5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected
          ? "border-primary ring-1 ring-primary"
          : "border-border hover:border-foreground/20"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-4 right-4 flex size-5 items-center justify-center rounded-full border transition-colors",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
        )}
      >
        {selected && <Check className="size-3" strokeWidth={3} />}
      </span>

      <span
        className={cn(
          "mb-4 flex size-11 items-center justify-center rounded-xl transition-colors",
          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:text-foreground"
        )}
      >
        <Icon className="size-5" />
      </span>

      <span className="mb-1 font-semibold">{mode.label}</span>
      <span className="mb-4 text-sm text-muted-foreground">{mode.description}</span>

      <span className="mt-auto flex flex-wrap gap-1.5">
        {mode.features.map((f) => (
          <span
            key={f}
            className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              selected ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {f}
          </span>
        ))}
      </span>
    </button>
  );
}


const MODE_ICON_MAP: Record<BusinessMode, LucideIcon> = {
  retail: Store,
  food_service: UtensilsCrossed,
  services: Wrench,
  rental: Car,
  hybrid: Layers,
};

function modeIcon(mode: string): LucideIcon {
  return MODE_ICON_MAP[mode as BusinessMode] ?? Store;
}
