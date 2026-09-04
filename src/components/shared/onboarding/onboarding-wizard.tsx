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
  PartyPopper,
  Rocket,
  Sparkles,
  Store,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  }, [step]);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 size-80 rounded-full bg-gradient-to-br from-emerald-200/30 to-teal-200/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-80 rounded-full bg-gradient-to-br from-violet-200/30 to-purple-200/30 blur-3xl" />
      </div>

      <div className="relative flex min-h-screen flex-col">
        {/* Header with progress */}
        <header className="border-b border-slate-200/50 bg-white/50 px-6 py-4 backdrop-blur-sm dark:border-slate-800/50 dark:bg-slate-900/50">
          <div className="mx-auto max-w-3xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
                  <Rocket className="size-4 text-white" />
                </div>
                <span className="font-semibold text-slate-900 dark:text-white">
                  Configuración Inicial
                </span>
              </div>
              <Badge variant="outline" className="text-xs">
                Paso {step + 1} de {STEPS.length}
              </Badge>
            </div>

            {/* Progress bar */}
            <div className="flex gap-2">
              {STEPS.map((s, i) => (
                <div
                  key={s.id}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-all duration-500",
                    i <= step
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                      : "bg-slate-200 dark:bg-slate-700"
                  )}
                />
              ))}
            </div>

            {/* Step labels */}
            <div className="mt-2 flex justify-between">
              {STEPS.map((s, i) => (
                <span
                  key={s.id}
                  className={cn(
                    "text-xs transition-colors",
                    i <= step
                      ? "font-medium text-emerald-600 dark:text-emerald-400"
                      : "text-slate-400 dark:text-slate-500"
                  )}
                >
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-3xl">
            {/* Step 0: Welcome */}
            {step === 0 && (
              <div className="space-y-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="mx-auto flex size-24 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-2xl shadow-emerald-500/25">
                  <Rocket className="size-12 text-white" />
                </div>
                <div className="space-y-3">
                  <h1 className="text-4xl font-bold text-slate-900 dark:text-white md:text-5xl">
                    ¡Bienvenido a{" "}
                    <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                      Multi-POS
                    </span>
                    !
                  </h1>
                  <p className="mx-auto max-w-md text-lg text-slate-600 dark:text-slate-400">
                    Tu organización ya está creada. Solo falta elegir el tipo de
                    negocio para activar las herramientas correctas.
                  </p>
                </div>

                {/* Org context (creada por el superAdmin: nombre + moneda) */}
                <div className="mx-auto flex max-w-lg flex-wrap items-center justify-center gap-3">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <Building2 className="size-4 text-emerald-500" />
                    <span className="text-sm font-medium">
                      {orgName || "Tu empresa"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <Coins className="size-4 text-amber-500" />
                    <span className="text-sm font-medium">{orgCurrency}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Nombre y moneda los definió tu administrador — puedes
                  ajustarlos después en Ajustes.
                </p>

                <div className="flex flex-col items-center gap-3 text-sm text-slate-500">
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="size-2 rounded-full bg-emerald-500" />
                      <span>POS</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="size-2 rounded-full bg-blue-500" />
                      <span>Admin</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="size-2 rounded-full bg-violet-500" />
                      <span>Portal</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Business Type */}
            {step === 1 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="space-y-2 text-center">
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
                    ¿Qué tipo de negocio operas?
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400">
                    Esto define qué páginas, permisos y herramientas se activan
                    para tu organización. Puedes cambiarlo después.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {BUSINESS_MODE_LIST.map((mode, i) => (
                    <ModeCard
                      key={mode.id}
                      mode={mode}
                      index={i}
                      selected={selectedMode === mode.id}
                      onSelect={() => setSelectedMode(mode.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Done */}
            {step === 2 && (
              <div className="space-y-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="mx-auto flex size-28 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-2xl shadow-emerald-500/25 animate-bounce">
                  <PartyPopper className="size-14 text-white" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-4xl font-bold text-slate-900 dark:text-white">
                    ¡Todo listo!
                  </h2>
                  <p className="mx-auto max-w-md text-lg text-slate-600 dark:text-slate-400">
                    <strong className="text-emerald-600">{orgName || "Tu empresa"}</strong>{" "}
                    quedó configurado como{" "}
                    <strong className="text-emerald-600">
                      {selectedModeData?.label}
                    </strong>
                    .
                  </p>
                </div>

                {/* Summary cards */}
                <div className="mx-auto flex max-w-lg flex-wrap justify-center gap-4">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <Building2 className="size-4 text-emerald-500" />
                    <span className="text-sm font-medium">
                      {orgName || "Tu empresa"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <Coins className="size-4 text-amber-500" />
                    <span className="text-sm font-medium">{orgCurrency}</span>
                  </div>
                </div>

                {/* Qué sigue: las guías del panel llevan a cada apartado */}
                {selectedModeData && (
                  <div className="mx-auto max-w-lg rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left dark:border-emerald-800 dark:bg-emerald-950/30">
                    <p className="mb-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                      Lo que se activa para ti
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedModeData.features.map((f) => (
                        <span
                          key={f}
                          className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-800"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-emerald-700/80 dark:text-emerald-300/70">
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

        {/* Error banner */}
        {error && (
          <div className="mx-auto max-w-3xl px-6 pb-2">
            <div
              role="alert"
              className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </div>
          </div>
        )}

        {/* Footer navigation */}
        <footer className="border-t border-slate-200/50 bg-white/50 px-6 py-4 backdrop-blur-sm dark:border-slate-800/50 dark:bg-slate-900/50">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={step === 0}
              className="gap-2"
            >
              <ArrowLeft className="size-4" />
              Atrás
            </Button>

            {step < STEPS.length - 1 ? (
              <Button
                onClick={handleNext}
                disabled={!canNext()}
                className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-700"
              >
                Continuar
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                onClick={handleFinish}
                disabled={loading}
                className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-700"
              >
                {loading ? (
                  <>
                    <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Configurando...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    ¡Ir al panel!
                  </>
                )}
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mode card                                                          */
/* ------------------------------------------------------------------ */

function ModeCard({
  mode,
  index,
  selected,
  onSelect,
}: {
  mode: BusinessModeInfo;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon: LucideIcon = modeIcon(mode.id);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative rounded-2xl border-2 p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg",
        selected
          ? "border-emerald-500 bg-emerald-50/50 shadow-lg shadow-emerald-500/10 dark:bg-emerald-950/30"
          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-slate-600"
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {selected && (
        <div className="absolute top-3 right-3 flex size-6 items-center justify-center rounded-full bg-emerald-500 shadow-md">
          <Check className="size-3.5 text-white" />
        </div>
      )}

      <div
        className={cn(
          "mb-3 flex size-12 items-center justify-center rounded-xl transition-colors",
          selected
            ? cn("bg-gradient-to-br text-white shadow-md", mode.gradient)
            : "bg-slate-100 text-slate-500 group-hover:text-slate-700 dark:bg-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300"
        )}
      >
        <Icon className="size-6" />
      </div>

      <h3 className="mb-1 font-semibold text-slate-900 dark:text-white">
        {mode.label}
      </h3>
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        {mode.description}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {mode.features.map((f) => (
          <span
            key={f}
            className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              selected
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
            )}
          >
            {f}
          </span>
        ))}
      </div>
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