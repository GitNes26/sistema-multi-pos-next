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
    <div className="relative mx-3 mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/5 via-transparent to-violet-500/5 px-3 py-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm"><Sparkles className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold">Mesa y cocina, guiadas en el POS real</p>
        <p className="text-[11px] text-muted-foreground">Selecciona mesa, envía la comanda, sigue cocina y cobra.</p>
      </div>
      {canTables && <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={start}><Armchair className="size-3.5" /> Mesas</Button>}
      {canKds && <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={start}><ChefHat className="size-3.5" /> Cocina (KDS)</Button>}
      <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={start}>
        <Armchair className="size-3.5" /><ChefHat className="size-3.5" /> Iniciar recorrido
      </Button>
      <button type="button" onClick={dismiss} aria-label="Ocultar guía del POS" className="absolute -right-2 -top-2 rounded-full border bg-background p-1 text-muted-foreground shadow-sm"><X className="size-3" /></button>
    </div>
  );
}
