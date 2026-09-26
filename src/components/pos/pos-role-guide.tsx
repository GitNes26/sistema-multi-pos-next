"use client";

import { useEffect, useState } from "react";
import { Armchair, ChefHat, Sparkles, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useGuideStore } from "@/stores/guide-store";
import { usePermission } from "@/hooks/use-permission";

const GUIDE_DISMISS_PREFIX = "multi-pos-pos-guide-dismissed";

export function PosRoleGuide({ open, onOpenChange }: {
  orgMode?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: session } = useSession();
  const orgId = session?.user?.activeOrganizationId ?? "";
  const userId = session?.user?.id ?? "";
  const canTables = usePermission("locations.view");
  const canKds = usePermission("orders.view");
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(`${GUIDE_DISMISS_PREFIX}:${orgId}:${userId}`) === "1");
    } catch {
      setDismissed(false);
    }
  }, [orgId, userId]);

  useEffect(() => {
    if (!open) return;
    useGuideStore.getState().start("pos-food", "/pos");
    onOpenChange(false);
  }, [open, onOpenChange]);

  const start = () => useGuideStore.getState().start("pos-food", "/pos");
  const dismiss = () => {
    try {
      localStorage.setItem(`${GUIDE_DISMISS_PREFIX}:${orgId}:${userId}`, "1");
    } catch {
      // El recorrido sigue disponible desde el encabezado.
    }
    setDismissed(true);
  };

  if (dismissed !== false || (!canTables && !canKds)) return null;

  return (
    <div className="mx-3 mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-primary/20 bg-accent/40 py-2 pr-1 pl-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="size-4" /></span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-sm font-semibold">Mesa y cocina, guiadas en el POS real</p>
        <p className="text-xs text-muted-foreground">
          Selecciona mesa, envía la comanda{canKds ? ", sigue cocina" : ""} y cobra.
        </p>
      </div>
      <div className="flex items-center gap-1 max-sm:w-full max-sm:pl-11">
        <Button size="sm" variant="outline" className="gap-1.5 bg-card max-sm:flex-1" onClick={start}>
          {canTables && <Armchair className="size-3.5" />}
          {canKds && <ChefHat className="size-3.5" />}
          Iniciar recorrido
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={dismiss} aria-label="Ocultar guía del POS" className="text-muted-foreground">
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
