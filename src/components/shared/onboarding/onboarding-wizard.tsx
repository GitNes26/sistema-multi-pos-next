"use client";

import { useState, useCallback } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Coffee,
  Globe,
  Home,
  Landmark,
  MapPin,
  PartyPopper,
  Phone,
  Rocket,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Truck,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InputGroupField } from "@/components/base/input-group-field";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

/* ------------------------------------------------------------------ */
/*  Business Mode Types                                                */
/* ------------------------------------------------------------------ */

interface BusinessModeOption {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  features: string[];
  color: string;
  gradient: string;
}

const BUSINESS_MODES: BusinessModeOption[] = [
  {
    id: "retail",
    label: "Tienda / Abarrotes",
    icon: ShoppingBag,
    description: "Ventas directas, inventario, variantes, combos y delivery.",
    features: [
      "Punto de venta",
      "Inventario",
      "Variantes de producto",
      "Combos",
      "Promociones",
      "Delivery",
      "Crédito",
    ],
    color: "emerald",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    id: "food_service",
    label: "Nevería / Restaurante / Café",
    icon: Coffee,
    description: "Productos configurables, menú digital, notas por ítem.",
    features: [
      "Product Builder",
      "Menú digital",
      "Notas por ítem",
      "Combos",
      "Delivery",
      "Crédito",
      "Propinas (próx.)",
    ],
    color: "amber",
    gradient: "from-amber-500 to-orange-600",
  },
  {
    id: "services",
    label: "Servicios",
    icon: Wrench,
    description: "Barbería, autolavado, veterinaria. Citas y asignación de personal.",
    features: [
      "Agendamiento",
      "Citas",
      "Asignación de personal",
      "Productos",
      "Promociones",
    ],
    color: "violet",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    id: "rental",
    label: "Renta / Alquiler",
    icon: Landmark,
    description: "Brincolines, fotografía, maquinaria. Calendario y contratos.",
    features: [
      "Reservaciones",
      "Calendario",
      "Disponibilidad",
      "Contratos",
      "Productos",
    ],
    color: "sky",
    gradient: "from-sky-500 to-blue-600",
  },
  {
    id: "hybrid",
    label: "Híbrido",
    icon: Sparkles,
    description: "Combinación de los anteriores. Todo activado.",
    features: [
      "Todo lo anterior",
      "Máxima flexibilidad",
      "Configuración manual",
    ],
    color: "rose",
    gradient: "from-rose-500 to-pink-600",
  },
];

/* ------------------------------------------------------------------ */
/*  Steps                                                              */
/* ------------------------------------------------------------------ */

const STEPS = [
  { id: "welcome", label: "Bienvenida" },
  { id: "business", label: "Tipo de negocio" },
  { id: "company", label: "Empresa" },
  { id: "location", label: "Sucursal" },
  { id: "done", label: "¡Listo!" },
];

/* ------------------------------------------------------------------ */
/*  Onboarding Wizard                                                  */
/* ------------------------------------------------------------------ */

interface OnboardingWizardProps {
  orgId?: string;
  orgName?: string;
}

export function OnboardingWizard({ orgId, orgName }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Form data
  const [selectedMode, setSelectedMode] = useState<string>("");
  const [companyName, setCompanyName] = useState(orgName || "");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("México");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [locationName, setLocationName] = useState("Principal");
  const [locationAddress, setLocationAddress] = useState("");

  const currentStep = STEPS[step];
  const selectedModeData = BUSINESS_MODES.find((m) => m.id === selectedMode);

  const canNext = useCallback(() => {
    switch (step) {
      case 0:
        return true; // Welcome always can advance
      case 1:
        return !!selectedMode; // Must select a mode
      case 2:
        return !!companyName.trim(); // Must have company name
      case 3:
        return !!locationName.trim(); // Must have location name
      case 4:
        return true; // Done always can finish
      default:
        return false;
    }
  }, [step, selectedMode, companyName, locationName]);

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    }
  }, [step]);

  const handleBack = useCallback(() => {
    if (step > 0) {
      setStep((s) => s - 1);
    }
  }, [step]);

  const handleFinish = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessMode: selectedMode,
          companyName,
          taxId,
          address,
          city,
          state,
          postalCode,
          country,
          phone,
          email,
          locationName,
          locationAddress,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push("/admin");
      } else {
        alert(data.error || "Error al guardar");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [selectedMode, companyName, taxId, address, city, state, postalCode, country, phone, email, locationName, locationAddress, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-emerald-200/30 to-teal-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-violet-200/30 to-purple-200/30 rounded-full blur-3xl" />
      </div>

      <div className="relative min-h-screen flex flex-col">
        {/* Header with progress */}
        <header className="px-6 py-4 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <Rocket className="w-4 h-4 text-white" />
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
                    "flex-1 h-1.5 rounded-full transition-all duration-500",
                    i <= step
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                      : "bg-slate-200 dark:bg-slate-700"
                  )}
                />
              ))}
            </div>

            {/* Step labels */}
            <div className="flex justify-between mt-2">
              {STEPS.map((s, i) => (
                <span
                  key={s.id}
                  className={cn(
                    "text-xs transition-colors",
                    i <= step
                      ? "text-emerald-600 dark:text-emerald-400 font-medium"
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
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-3xl">
            {/* Step 0: Welcome */}
            {step === 0 && (
              <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/25">
                  <Rocket className="w-12 h-12 text-white" />
                </div>
                <div className="space-y-3">
                  <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white">
                    ¡Bienvenido a{" "}
                    <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                      Multi-POS
                    </span>
                    !
                  </h1>
                  <p className="text-lg text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                    Configura tu negocio en solo unos pasos. Empecemos eligiendo el tipo de negocio que operas.
                  </p>
                </div>
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>POS</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>Admin</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-violet-500" />
                      <span>Portal</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Business Type */}
            {step === 1 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
                    ¿Qué tipo de negocio operas?
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400">
                    Selecciona la opción que mejor describa tu actividad. Podrás cambiar esto después.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {BUSINESS_MODES.map((mode, i) => {
                    const Icon = mode.icon;
                    const isSelected = selectedMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => setSelectedMode(mode.id)}
                        className={cn(
                          "relative group text-left p-5 rounded-2xl border-2 transition-all duration-300",
                          "hover:shadow-lg hover:-translate-y-0.5",
                          isSelected
                            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-lg shadow-emerald-500/10"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600"
                        )}
                        style={{ animationDelay: `${i * 80}ms` }}
                      >
                        {/* Selected check */}
                        {isSelected && (
                          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-md">
                            <Check className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}

                        {/* Icon */}
                        <div
                          className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors",
                            isSelected
                              ? "bg-gradient-to-br " + mode.gradient + " text-white shadow-md"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300"
                          )}
                        >
                          <Icon className="w-6 h-6" />
                        </div>

                        {/* Title + description */}
                        <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                          {mode.label}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                          {mode.description}
                        </p>

                        {/* Features */}
                        <div className="flex flex-wrap gap-1.5">
                          {mode.features.map((f) => (
                            <span
                              key={f}
                              className={cn(
                                "text-xs px-2 py-0.5 rounded-full",
                                isSelected
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
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Company Info */}
            {step === 2 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 text-sm font-medium mb-2">
                    {selectedModeData && <selectedModeData.icon className="w-4 h-4" />}
                    {selectedModeData?.label}
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
                    Datos de tu empresa
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400">
                    Cuéntanos sobre tu negocio. Solo lo básico por ahora.
                  </p>
                </div>

                <div className="max-w-lg mx-auto space-y-4">
                  <InputGroupField
                    label="Nombre del negocio"
                    placeholder="Ej: Mi Tienda, Café Dreams, etc."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    leftIcon={<Store className="w-4 h-4 text-slate-400" />}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <InputGroupField
                      label="RFC / ID fiscal (opcional)"
                      placeholder="XAXX010101000"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      leftIcon={<Tag className="w-4 h-4 text-slate-400" />}
                    />
                    <InputGroupField
                      label="Teléfono (opcional)"
                      placeholder="555 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      leftIcon={<Phone className="w-4 h-4 text-slate-400" />}
                    />
                  </div>

                  <InputGroupField
                    label="Dirección (opcional)"
                    placeholder="Calle, número, colonia..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    leftIcon={<MapPin className="w-4 h-4 text-slate-400" />}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <InputGroupField
                      label="Ciudad"
                      placeholder="CDMX"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                    <InputGroupField
                      label="Estado"
                      placeholder="CDMX"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                    />
                    <InputGroupField
                      label="Código postal"
                      placeholder="06600"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                    />
                  </div>

                  <InputGroupField
                    label="Email del negocio (opcional)"
                    placeholder="contacto@mitienda.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    leftIcon={<Globe className="w-4 h-4 text-slate-400" />}
                  />
                </div>
              </div>
            )}

            {/* Step 3: First Location */}
            {step === 3 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
                    Primera sucursal
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400">
                    Crea tu primera sucursal. Puedes agregar más después.
                  </p>
                </div>

                <div className="max-w-lg mx-auto space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <InputGroupField
                      label="Nombre de la sucursal"
                      placeholder="Ej: Principal, Centro, Norte..."
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      required
                      leftIcon={<Home className="w-4 h-4 text-slate-400" />}
                    />
                  </div>

                  <InputGroupField
                    label="Dirección de la sucursal (opcional)"
                    placeholder="Calle, número, colonia..."
                    value={locationAddress}
                    onChange={(e) => setLocationAddress(e.target.value)}
                    leftIcon={<MapPin className="w-4 h-4 text-slate-400" />}
                  />

                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                          ¿Agregas más sucursales después?
                        </p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                          Sí, puedes crear sucursales adicionales desde{" "}
                          <strong>Operación → Sucursales</strong> en el panel administrativo.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Done */}
            {step === 4 && (
              <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="mx-auto w-28 h-28 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/25 animate-bounce">
                  <PartyPopper className="w-14 h-14 text-white" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-4xl font-bold text-slate-900 dark:text-white">
                    ¡Todo listo!
                  </h2>
                  <p className="text-lg text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                    Tu negocio{" "}
                    <strong className="text-emerald-600">{companyName}</strong> está
                    configurado como{" "}
                    <strong className="text-emerald-600">{selectedModeData?.label}</strong>.
                  </p>
                </div>

                {/* Summary cards */}
                <div className="flex flex-wrap justify-center gap-4 max-w-lg mx-auto">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <Building2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-medium">{companyName}</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                    {selectedModeData && <selectedModeData.icon className="w-4 h-4 text-emerald-500" />}
                    <span className="text-sm font-medium">{selectedModeData?.label}</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <Home className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-medium">{locationName}</span>
                  </div>
                </div>

                <p className="text-sm text-slate-500">
                  Próximos pasos: agrega productos, configura precios y empieza a vender.
                </p>
              </div>
            )}
          </div>
        </main>

        {/* Footer navigation */}
        <footer className="px-6 py-4 border-t border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={step === 0}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Atrás
            </Button>

            {step < STEPS.length - 1 ? (
              <Button
                onClick={handleNext}
                disabled={!canNext()}
                className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25"
              >
                Continuar
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleFinish}
                disabled={loading}
                className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Configurando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
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
