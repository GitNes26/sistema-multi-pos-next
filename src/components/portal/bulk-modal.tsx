"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Scale } from "lucide-react";
import { usePortalStore } from "@/stores/portal-store";
import { money, round2, round3, snapToStep } from "@/lib/pos/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogComponent } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

interface UnitOption {
  unitId: string;
  unitName: string;
  unitAbbrev: string;
  price: number;
  step: number;
  maxQty: number;
}

export function BulkModal() {
  const product = usePortalStore((s) => s.bulkProduct);
  const setBulkProduct = usePortalStore((s) => s.setBulkProduct);
  const addBulk = usePortalStore((s) => s.addBulk);

  const [mode, setMode] = useState<"qty" | "amount">("qty");
  const [unitId, setUnitId] = useState<string>("");
  const [qty, setQty] = useState<number>(0);
  const [amount, setAmount] = useState<string>("");

  const units: UnitOption[] = useMemo(() => {
    if (!product?.bulk) return [];
    const list: UnitOption[] = [
      {
        unitId: product.bulk.unitId,
        unitName: product.bulk.unitName,
        unitAbbrev: product.bulk.unitAbbrev,
        price: product.bulk.price,
        step: product.bulk.step || 0.01,
        maxQty: product.bulk.maxQty,
      },
    ];
    if (product.bulk.allowSplit && product.bulk.split) {
      list.push({
        unitId: product.bulk.split.unitId,
        unitName: product.bulk.split.unitName,
        unitAbbrev: product.bulk.split.unitAbbrev,
        price: product.bulk.split.price,
        step: 1,
        maxQty: 0,
      });
    }
    return list;
  }, [product]);

  useEffect(() => {
    if (units.length) {
      setUnitId((prev) => (units.some((u) => u.unitId === prev) ? prev : units[0].unitId));
    }
  }, [units]);

  const selected = units.find((u) => u.unitId === unitId) ?? units[0];

  useEffect(() => {
    if (selected) {
      setQty(product?.bulk?.minQty ?? 0);
      setAmount("");
      setMode("qty");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.unitId]);

  if (!product || !product.bulk) return null;

  const minQty = selected ? (product.bulk.allowSplit && selected.unitId === product.bulk.split?.unitId ? 1 : product.bulk.minQty) : 0;
  const effectiveQty = mode === "amount" && selected ? round3(Number(amount) / selected.price) : qty;
  const total = selected ? round2(effectiveQty * selected.price) : 0;

  const changeQty = (delta: number) => {
    if (!selected) return;
    const step = selected.step || 0.01;
    const next = snapToStep(Math.max(minQty, (mode === "amount" ? effectiveQty : qty) + delta), step);
    setMode("qty");
    setQty(next);
  };

  const handleAdd = () => {
    if (!product || !selected || effectiveQty <= 0) return;
    addBulk(product, {
      qty: effectiveQty,
      unitId: selected.unitId,
      unitName: selected.unitName,
      unitAbbrev: selected.unitAbbrev,
      pricePerUnit: selected.price,
    });
    setBulkProduct(null);
  };

  return (
    <DialogComponent
      open
      onOpenChange={(o) => !o && setBulkProduct(null)}
      icon={<Scale className="size-4 text-primary" />}
      title={product.name}
      description="A granel — selecciona la cantidad"
      className="sm:max-w-sm"
      bodyClassName="space-y-4"
      footer={
        <Button className="w-full" onClick={handleAdd} disabled={effectiveQty <= 0}>
          Agregar al carrito
        </Button>
      }
    >
          {units.length > 1 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Unidad de medida</p>
              <div className="flex gap-2">
                {units.map((u) => (
                  <button
                    key={u.unitId}
                    type="button"
                    onClick={() => setUnitId(u.unitId)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      u.unitId === unitId
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {u.unitName} ({u.unitAbbrev})
                  </button>
                ))}
              </div>
            </div>
          )}

          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(v) => v && (setMode(v as "qty" | "amount"), setAmount(""))}
            className="w-full"
          >
            <ToggleGroupItem value="qty" className="flex-1">
              Por cantidad
            </ToggleGroupItem>
            <ToggleGroupItem value="amount" className="flex-1">
              Por monto
            </ToggleGroupItem>
          </ToggleGroup>

          {mode === "qty" ? (
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="icon" onClick={() => changeQty(-(selected?.step ?? 0.01))}>
                <Minus className="size-4" />
              </Button>
              <div className="text-center">
                <span className="block text-2xl font-bold tabular-nums">{round3(effectiveQty)}</span>
                <span className="text-xs text-muted-foreground">{selected?.unitAbbrev}</span>
              </div>
              <Button variant="outline" size="icon" onClick={() => changeQty(selected?.step ?? 0.01)}>
                <Plus className="size-4" />
              </Button>
            </div>
          ) : (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                ¿Cuánto quieres gastar? ({selected?.unitAbbrev})
              </p>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          )}

          <div className="rounded-lg bg-muted p-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Precio</span>
              <span>
                {selected ? money(selected.price) : "—"}/{selected?.unitAbbrev}
              </span>
            </div>
            <div className="mt-1 flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
          </div>
    </DialogComponent>
  );
}
