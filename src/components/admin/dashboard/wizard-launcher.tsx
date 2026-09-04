"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Package,
  Puzzle,
  Boxes,
  Armchair,
  ChefHat,
  Truck,
  Landmark,
  Tag,
  CreditCard,
  Building2,
  ExternalLink,
  Sparkles,
  ChevronRight,
  X,
  Store,
  UtensilsCrossed,
  Wrench,
  Car,
  Layers,
  RefreshCcw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DialogComponent } from "@/components/ui/dialog";
import { FirstOrderWizard } from "@/components/shared/wizards/first-order-wizard";
import { useBusinessMode } from "@/hooks/use-business-mode";
import { usePermission } from "@/hooks/use-permission";
import {
  businessModeInfo,
  MODE_WIZARDS,
  WIZARD_ACTIONS,
  type WizardActionKind,
} from "@/lib/business-modes";
import {
  clearWelcomeGuideDismissal,
  welcomeGuideDismissKey,
  WELCOME_GUIDE_RESTORE_EVENT,
} from "@/lib/welcome-guide";
import { cn } from "@/lib/utils";
import type { BusinessMode } from "@/lib/auth/options";

// FASE — Guía de bienvenida del dashboard: asistentes que llevan al usuario
// al apartado real (Catálogos → Productos, Ajustes → Entrega, etc.) para que
// llene el formulario existente y aprenda dónde está cada cosa. Las tarjetas
// dependen del businessMode de la organización: cada modo muestra los wizards
// que le corresponden (retail → inventario/crédito; food_service → combos,
// mesas, cocina; etc.).

const ACTION_ICONS: Record<WizardActionKind, LucideIcon> = {
  product: Package,
  combos: Puzzle,
  inventory: Boxes,
  tables: Armchair,
  kds: ChefHat,
  delivery: Truck,
  credit: Landmark,
  promotion: Tag,
  payments: CreditCard,
  company: Building2,
  portal: ExternalLink,
};

const MODE_ICONS: Record<BusinessMode, LucideIcon> = {
  retail: Store,
  food_service: UtensilsCrossed,
  services: Wrench,
  rental: Car,
  hybrid: Layers,
};

interface WizardLauncherProps {
  productCount?: number;
  totalSales?: number;
}

export function WizardLauncher({ productCount = 0, totalSales = 0 }: WizardLauncherProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const orgId =
    (session?.user as { activeOrganizationId?: string; organizationId?: string } | undefined)
      ?.activeOrganizationId ??
    (session?.user as { organizationId?: string } | undefined)?.organizationId ??
    "";
  // Ocultar la guía por organización (mismo patrón que el onboarding del portal).
  const dismissKey = welcomeGuideDismissKey(orgId);
  const [dismissed, setDismissed] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(dismissKey) === "1") setDismissed(true);
    } catch {
      /* SSR / almacenamiento no disponible */
    }
  }, [dismissKey]);

  // “Volver a mostrar la guía” desde el menú de usuario: reaparece al instante.
  useEffect(() => {
    const onRestore = () => {
      clearWelcomeGuideDismissal(orgId);
      setDismissed(false);
    };
    window.addEventListener(WELCOME_GUIDE_RESTORE_EVENT, onRestore);
    return () => window.removeEventListener(WELCOME_GUIDE_RESTORE_EVENT, onRestore);
  }, [orgId]);

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey, "1");
    } catch {
      /* best-effort */
    }
    setDismissed(true);
  };

  const mode = useBusinessMode();
  const info = businessModeInfo(mode);
  const ModeIcon = MODE_ICONS[mode];

  // Permisos por acción.
  const canProduct = usePermission("products.manage");
  const canInventory = usePermission("inventory.manage");
  const canTables = usePermission("locations.view");
  const canKds = usePermission("orders.view");
  const canPromotion = usePermission("promotions.manage");
  const canSettings = usePermission("settings.manage");

  const permissionFor = (kind: WizardActionKind): boolean => {
    switch (kind) {
      case "product":
      case "combos":
        return canProduct;
      case "inventory":
        return canInventory;
      case "tables":
        return canTables;
      case "kds":
        return canKds;
      case "delivery":
      case "credit":
      case "payments":
      case "company":
        return canSettings;
      case "promotion":
        return canPromotion;
      default:
        return true; // portal: sin permiso
    }
  };

  // ── Estado del negocio ─────────────────────────────────────────────────────
  const emptyBusiness = productCount === 0 && totalSales === 0;
  const catalogReady = productCount > 0 && totalSales === 0;

  // Tarjetas del modo actual, filtradas por permiso.
  const actions = MODE_WIZARDS[mode]
    .map((kind) => WIZARD_ACTIONS[kind])
    .filter((a) => permissionFor(a.kind));

  // Catálogo listo → el portal, envíos y promociones pasan al frente.
  if (catalogReady) {
    const priority = ["portal", "delivery", "promotion"];
    const prio = actions.filter((a) => priority.includes(a.kind));
    const rest = actions.filter((a) => !priority.includes(a.kind));
    actions.length = 0;
    actions.push(...prio, ...rest);
  }

  if (!actions.length) return null;
  if (dismissed) return null;

  const hero =
    emptyBusiness
      ? {
          emoji: "🎉",
          eyebrow: "Tu negocio en marcha",
          title: "¡Bienvenido a tu negocio!",
          description:
            "Estás a unos minutos de tu primera venta. Sigue la guía: cada tarjeta te lleva al apartado exacto donde se configura cada cosa.",
        }
      : catalogReady
        ? {
            emoji: "🚀",
            eyebrow: "Casi en el aire",
            title: "¡Tu catálogo está listo!",
            description:
              "Ya puedes vender en tu caja. Cuando quieras crecer: prueba tu portal como cliente, configura envíos o lanza una promoción.",
          }
        : {
            emoji: "✨",
            eyebrow: "Acciones guiadas",
            title: "Sigue haciendo crecer tu negocio",
            description:
              "Pasos guiados hacia tu catálogo, promociones, envíos y más.",
          };

  const go = (href: string) => {
    // A la sección real: ahí está el formulario que ya existe.
    router.push(href);
  };

  return (
    <>
      <Card className="relative overflow-hidden border-primary/25">
        {/* Decoración de fondo */}
        <div className="pointer-events-none absolute -top-28 -right-20 size-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-64 rounded-full bg-violet-500/10 blur-3xl" />
        {/* Cerrar guía (persiste por organización en localStorage) */}
        <button
          type="button"
          onClick={dismiss}
          title="Ocultar esta guía"
          aria-label="Ocultar guía de bienvenida"
          className="absolute top-3 right-3 z-20 rounded-full p-1.5 text-muted-foreground/70 transition hover:bg-background/70 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <CardContent className="relative z-10 overflow-hidden py-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary/15 to-violet-500/15 px-3 py-1 text-[11px] font-black tracking-wide text-primary uppercase ring-1 ring-primary/20">
                <Sparkles className="size-3" />
                {hero.eyebrow}
              </span>
              <h2 className="mt-2 flex items-center gap-2 text-2xl font-black tracking-tight">
                {hero.title} <span aria-hidden>{hero.emoji}</span>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{hero.description}</p>
            </div>
            {catalogReady && (
              <a
                href="/pos"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-600 hover:to-teal-700"
              >
                <Package className="size-4" /> Abrir mi POS
              </a>
            )}
          </div>

          {/* ── Tipo de negocio: descripción de lo que incluye este modo ── */}
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-gradient-to-r from-primary/5 to-transparent p-4">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md",
                  info.gradient
                )}
              >
                <ModeIcon className="size-5" />
              </span>
              <div>
                <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  Tu tipo de negocio
                </p>
                <p className="text-sm font-black">{info.label}</p>
              </div>
            </div>
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
              {info.description}
            </p>
            <button
              type="button"
              onClick={() => router.push("/onboarding")}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-primary"
            >
              <RefreshCcw className="size-3.5" />
              Cambiar tipo de negocio
            </button>
          </div>

          {/* Chips de características del modo */}
          <div className="mb-5 flex flex-wrap gap-1.5">
            {info.features.map((f) => (
              <span
                key={f}
                className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-border/60"
              >
                {f}
              </span>
            ))}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {actions.map((a, i) => {
              const Icon = ACTION_ICONS[a.kind];
              return (
                <button
                  key={a.kind}
                  type="button"
                  onClick={() => (a.kind === "portal" ? setPortalOpen(true) : go(a.href))}
                  className="group relative flex flex-col gap-2.5 overflow-hidden rounded-2xl border bg-background/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/60 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.99]"
                >
                  <span className="absolute top-2.5 right-3 flex size-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-black text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/15 text-primary ring-1 ring-primary/20">
                    <Icon className="size-5" />
                  </span>
                  <span className="pr-5">
                    <span className="flex items-center gap-1 text-sm font-bold">
                      {a.kind === "product" && catalogReady ? "Agregar producto" : a.title}
                      <ChevronRight className="size-3.5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {a.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Diálogo del portal: explica cómo probar la tienda en línea */}
      {portalOpen && (
        <DialogComponent
          open
          onOpenChange={(o) => !o && setPortalOpen(false)}
          title="Prueba tu portal de cliente"
          description="Así ven tus clientes tu negocio en línea"
          icon={<ExternalLink className="size-4 text-primary" />}
          size="2xl"
        >
          <FirstOrderWizard onClose={() => setPortalOpen(false)} />
        </DialogComponent>
      )}
    </>
  );
}