"use client";

import { useMemo, useState } from "react";
import { Search, Trash2, UserRound } from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePosStore } from "@/stores/pos-store";
import { money } from "@/lib/pos/money";
import { pointsToMoney } from "@/lib/pos/pricing";

interface CustomerModalProps {
  open: boolean;
  onClose: () => void;
}

export function CustomerModal({ open, onClose }: CustomerModalProps) {
  const customers = usePosStore((s) => s.customers);
  const customerId = usePosStore((s) => s.customerId);
  const setCustomer = usePosStore((s) => s.setCustomer);
  const loyalty = usePosStore((s) => s.loyalty);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(needle) ||
        (c.phone ?? "").includes(needle) ||
        (c.customerCode ?? "").toLowerCase().includes(needle)
    );
  }, [customers, q]);

  const select = (id: string) => {
    setCustomer(id);
    onClose();
  };

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      icon={<UserRound className="size-5 text-primary" />}
      title="Asociar cliente"
      description="Selecciona un cliente para asociarlo al ticket."
      className="sm:max-w-md"
      bodyClassName="space-y-3"
      footerClassName="gap-2"
      footer={
        <>
          {customerId && (
            <Button variant="outline" onClick={() => setCustomer(null)} className="text-destructive">
              <Trash2 className="size-4" /> Quitar cliente
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </>
      }
    >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, teléfono o nº de cliente"
              className="pl-9"
            />
          </div>

          <div className="space-y-1.5">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sin clientes que coincidan.
              </p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => select(c.id)}
                  className="flex w-full items-center gap-3 rounded-xl border bg-card px-3 py-2 text-left transition hover:border-primary/50"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {c.fullName
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.fullName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.phone ?? c.email ?? c.customerCode ?? "—"}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                      {money(pointsToMoney(c.points, loyalty.pointValue))}
                    </span>
                    <span className="mt-0.5 text-[10px] text-muted-foreground">{Math.floor(c.points)} pts</span>
                  </span>
                </button>
              ))
            )}
          </div>
    </DialogComponent>
  );
}