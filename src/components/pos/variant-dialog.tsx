"use client";

import { useEffect, useMemo, useState } from "react";
import { CornerDownLeft, Layers, Search } from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { PosProduct, PosVariant } from "@/types/pos";
import { money } from "@/lib/pos/money";
import { cn } from "@/lib/utils";

export function VariantDialog({
  product,
  onClose,
  onSelect,
}: {
  product: PosProduct | null;
  onClose: () => void;
  onSelect: (variant: PosVariant) => void;
}) {
  const [q, setQ] = useState("");
  const [highlighted, setHighlighted] = useState(0);

  const isOut = (v: PosVariant) => !v.isActive || (product?.trackInventory && v.stock <= 0);

  const filtered = useMemo(() => {
    if (!product) return [];
    const t = q.trim().toLowerCase();
    if (!t) return product.variants;
    return product.variants.filter((v) => v.name.toLowerCase().includes(t));
  }, [product, q]);

  // Limpiar el buscador y el resaltado cada que se cierra el diálogo.
  useEffect(() => {
    if (!product) {
      setQ("");
      setHighlighted(0);
    }
  }, [product]);

  useEffect(() => {
    setHighlighted(0);
  }, [q]);

  const pick = (v: PosVariant) => {
    if (isOut(v)) return;
    onSelect(v);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Enter selecciona el resaltado, o el primer elemento habilitado.
      const target =
        filtered[highlighted] && !isOut(filtered[highlighted])
          ? filtered[highlighted]
          : filtered.find((v) => !isOut(v));
      if (target) pick(target);
    }
  };

  return (
    <DialogComponent
      open={!!product}
      onOpenChange={(o) => !o && onClose()}
      icon={<Layers className="size-5 text-primary" />}
      title={product?.name}
      description="Elige una variante para agregar al ticket."
      className="sm:max-w-md"
      bodyClassName="space-y-3"
      footerClassName="flex items-center justify-between gap-2"
      footer={
        <>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CornerDownLeft className="size-3.5" /> Enter para agregar · flechas para navegar
          </p>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
        </>
      }
    >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              className="pl-9 md:pl-9"
              placeholder="Buscar variante…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            {filtered.map((v, i) => {
              const out = isOut(v);
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={out}
                  onClick={() => pick(v)}
                  onMouseEnter={() => setHighlighted(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                    out
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-muted",
                    highlighted === i && "border-primary bg-muted ring-1 ring-primary"
                  )}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/60">
                    {v.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.imageUrl} alt={v.name} className="size-full object-cover" />
                    ) : (
                      <Layers className="size-5 text-muted-foreground" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {v.name === "Default" ? "Estándar" : v.name}
                    </span>
                    {out && (
                      <span className="block text-xs text-muted-foreground">
                        {!v.isActive ? "Inactiva" : "Sin stock"}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums">{money(v.price)}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Sin variantes que coincidan</p>
            )}
          </div>
    </DialogComponent>
  );
}
