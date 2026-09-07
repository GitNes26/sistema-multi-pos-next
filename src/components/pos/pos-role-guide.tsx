"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Armchair,
  ChefHat,
  ClipboardList,
  Coins,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogComponent } from "@/components/ui/dialog";
import { WizardShell, type WizardStep } from "@/components/shared/wizards/wizard-shell";
import { usePermission } from "@/hooks/use-permission";
import { cn } from "@/lib/utils";

// Guía de roles para el POS (modos food_service/hybrid): el mesero y cocina
// trabajan desde el POS y el KDS, no desde el panel admin — esta tarjeta les
// muestra dónde está cada herramienta (Mesa y pantalla de cocina) antes de
// que tengan que descubrirlo por ensayo y error. Descartable por org+usuario;
// se reabre con "Guía rápida" en la tarjeta misma o con «Guía del POS» en el
// menú del header (el diálogo es controlado por el padre vía open/onOpenChange
// para que pueda reabrirse aunque la tarjeta ya esté descartada).

const GUIDE_DISMISS_PREFIX = "multi-pos-pos-guide-dismissed";

const wizardSteps: WizardStep[] = [
  { id: "intro", title: "Tu turno en 3 pasos" },
  { id: "mesa", title: "Toma el pedido" },
  { id: "kds", title: "Cocina lo sigue" },
  { id: "cobro", title: "Cobra y libera" },
];

export function PosRoleGuide({
  orgMode,
  open,
  onOpenChange,
}: {
  orgMode?: string | null;
  /** Controla el diálogo del wizard (lo abre el menú del header o la tarjeta). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const orgId =
    (session?.user as { activeOrganizationId?: string } | undefined)
      ?.activeOrganizationId ?? "";
  const userId = (session?.user as { id?: string } | undefined)?.id ?? "";

  const [dismissed, setDismissed] = useState<boolean | null>(null); // null = cargando

  useEffect(() => {
    try {
      setDismissed(
        localStorage.getItem(`${GUIDE_DISMISS_PREFIX}:${orgId}:${userId}`) === "1"
      );
    } catch {
      setDismissed(false);
    }
  }, [orgId, userId]);

  // Superficies que el rol alcanza (el propio permiso oculta lo que no aplica).
  const canTables = usePermission("locations.view");
  const canKds = usePermission("orders.view");

  // La tarjeta se oculta al descartarla o si el rol no alcanza ninguna
  // superficie; el diálogo del wizard es independiente (controlado por el
  // padre) y se reabre desde el menú del header aunque la tarjeta esté oculta.
  const showStrip = dismissed === false && (canTables || canKds);

  const dismiss = () => {
    try {
      localStorage.setItem(`${GUIDE_DISMISS_PREFIX}:${orgId}:${userId}`, "1");
    } catch {
      /* best-effort */
    }
    setDismissed(true);
  };

  return (
    <>
      {showStrip && (
      <div className="relative mx-3 mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/5 via-transparent to-violet-500/5 px-3 py-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold leading-tight">
            ¿Mesero o cocina? Tus herramientas viven aquí
          </p>
          <p className="text-[11px] leading-tight text-muted-foreground">
            Toma pedidos por mesa y sigue la pantalla de cocina sin abrir el panel.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {canTables && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={() => router.push("/admin/tables")}
            >
              <Armchair className="size-3.5" /> Mesas
            </Button>
          )}
          {canKds && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={() => router.push("/kds")}
            >
              <ChefHat className="size-3.5" /> Cocina (KDS)
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-[11px] text-primary"
            onClick={() => onOpenChange(true)}
          >
            <Sparkles className="size-3.5" /> Guía rápida
          </Button>
        </div>
        <button
          type="button"
          onClick={dismiss}
          title="Ocultar esta guía"
          aria-label="Ocultar guía del POS"
          className="absolute -top-2 -right-2 z-10 rounded-full border bg-background p-1 text-muted-foreground/70 shadow-sm transition hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      </div>
      )}

      {open && (
        <DialogComponent
          open={open}
          onOpenChange={onOpenChange}
          icon={<Sparkles className="size-4 text-primary" />}
          title="Mesa y cocina en 3 pasos"
          description={
            orgMode === "hybrid"
              ? "El flujo mesa → cocina → cobro de tu negocio híbrido"
              : "El flujo mesa → cocina → cobro de tu restaurante"
          }
        >
          <WizardShell steps={wizardSteps} onFinish={() => onOpenChange(false)} finishLabel="¡Entendido!">
            {({ step }) => {
              if (step.id === "intro") {
                return (
                  <ol className="space-y-2.5 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2.5 rounded-xl border bg-muted/30 p-3">
                      <Armchair className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>
                        <strong className="text-foreground">1 · Toma el pedido.</strong>{" "}
                        En este POS elige la mesa antes de agregar productos: todo cae
                        al ticket de esa mesa.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5 rounded-xl border bg-muted/30 p-3">
                      <ChefHat className="mt-0.5 size-4 shrink-0 text-amber-600" />
                      <span>
                        <strong className="text-foreground">2 · Envía a cocina.</strong>{" "}
                        Con «Enviar a cocina» el pedido aparece al instante en la
                        pantalla KDS; ahí avanzan cada ítem hasta «listo».
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5 rounded-xl border bg-muted/30 p-3">
                      <Coins className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      <span>
                        <strong className="text-foreground">3 · Cobra la mesa.</strong>{" "}
                        El cobro libera la mesa y el pedido sale del KDS
                        automáticamente.
                      </span>
                    </li>
                  </ol>
                );
              }
              if (step.id === "mesa") {
                return (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      El mapa de mesas muestra el estado en vivo (libre, ocupada,
                      cuenta). Desde aquí abres el salón sin pasar por el panel
                      administrativo.
                    </p>
                    {canTables && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          onOpenChange(false);
                          router.push("/admin/tables");
                        }}
                      >
                        <Armchair className="size-4" /> Abrir mapa de mesas
                      </Button>
                    )}
                  </div>
                );
              }
              if (step.id === "kds") {
                return (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      La pantalla de cocina (KDS) es la vista a pantalla completa del
                      equipo de cocina: ve cada pedido entrante en vivo, avanza ítems
                      a «listo» y nunca toca la caja.
                    </p>
                    {canKds && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          onOpenChange(false);
                          router.push("/kds");
                        }}
                      >
                        <ChefHat className="size-4" /> Abrir pantalla de cocina
                      </Button>
                    )}
                  </div>
                );
              }
              return (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2.5 rounded-xl border bg-muted/30 p-3">
                    <ClipboardList className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      En el ticket del POS verás el{" "}
                      <strong className="text-foreground">estado de cocina</strong> de
                      la mesa (número de orden de cocina y qué ítems están listos) —
                      sin preguntar de papel.
                    </span>
                  </div>
                  <p>
                    Cuando cobres, la mesa se libera y su orden desaparece del KDS.
                    Si la mesa se cerró sin cobrar, el botón{" "}
                    <strong className="text-foreground">cancelar</strong> junto a la
                    orden de cocina la retira del tablero.
                  </p>
                </div>
              );
            }}
          </WizardShell>
        </DialogComponent>
      )}
    </>
  );
}
