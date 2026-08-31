"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { usePortalStore } from "@/stores/portal-store";
import { money, round2, round3, snapToStep } from "@/lib/pos/money";
import { swalToast } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/portal/bottom-sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Numpad, type NumpadKey } from "@/components/pos/numpad";
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
  const [editing, setEditing] = useState(false);
  const [editStr, setEditStr] = useState("");
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const repeatTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.unitId]);

  useEffect(() => {
    return () => {
      if (repeatTimeout.current) clearTimeout(repeatTimeout.current);
      if (repeatTimer.current) clearInterval(repeatTimer.current);
    };
  }, []);

  if (!product || !product.bulk) return null;

  const minQty = selected ? (product.bulk.allowSplit && selected.unitId === product.bulk.split?.unitId ? 1 : product.bulk.minQty) : 0;
  const parsedAmount = mode === "amount" ? Math.max(0, parseFloat(amount) || 0) : 0;
  const effectiveQty = mode === "amount" && selected ? round3(parsedAmount / selected.price) : qty;
  const total = mode === "amount" ? parsedAmount : (selected ? round2(effectiveQty * selected.price) : 0);
  const available = product.trackInventory ? Math.floor(product.stock) : null;

  const changeQty = (delta: number) => {
    if (!selected) return;
    const step = selected.step || 0.01;
    let next = snapToStep(Math.max(minQty, (mode === "amount" ? effectiveQty : qty) + delta), step);
    if (available != null) next = Math.min(next, available);
    setMode("qty");
    setQty(next);
  };

  // Long-press en +/-: un paso inmediato y luego incremento continuo.
  const stopRepeat = () => {
    if (repeatTimeout.current) clearTimeout(repeatTimeout.current);
    if (repeatTimer.current) clearInterval(repeatTimer.current);
    repeatTimeout.current = null;
    repeatTimer.current = null;
  };

  const startRepeat = (delta: number) => {
    changeQty(delta);
    repeatTimeout.current = setTimeout(() => {
      repeatTimer.current = setInterval(() => changeQty(delta), 110);
    }, 480);
  };

  const startEdit = () => {
    setEditStr(String(round3(effectiveQty)));
    setEditing(true);
  };

  const onNumpadKey = (key: NumpadKey) => {
    if (key === "clear") return setEditStr("");
    if (key === "backspace") return setEditStr((s) => s.slice(0, -1));
    if (key === ".") {
      if (!editStr.includes(".")) setEditStr(editStr === "" ? "0." : editStr + ".");
      return;
    }
    setEditStr(editStr + key);
  };

  const commitEdit = () => {
    const val = parseFloat(editStr.replace(",", ".")) || 0;
    let next = round3(Math.max(minQty, val));
    if (available != null) next = Math.min(next, available);
    setQty(next);
    setEditing(false);
  };

  const handleAdd = () => {
    if (!product || !selected || effectiveQty <= 0) return;
    const res = addBulk(product, {
      qty: effectiveQty,
      unitId: selected.unitId,
      unitName: selected.unitName,
      unitAbbrev: selected.unitAbbrev,
      pricePerUnit: selected.price,
    });
    if (res.added <= 0) {
      swalToast("Sin stock disponible", "info");
    } else if (res.limited) {
      swalToast(`Cantidad limitada a ${res.added} ${selected.unitAbbrev} por stock`, "info");
    }
    setBulkProduct(null);
  };

  return (
    <BottomSheet
      open
      onOpenChange={(o) => !o && setBulkProduct(null)}
      title={product.name}
      description="A granel — selecciona la cantidad"
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
            editing ? (
              <div className="space-y-2">
                <div className="rounded-xl border bg-card px-3 py-2 text-center">
                  <span className="text-2xl font-bold tabular-nums">{editStr || "0"}</span>
                  <span className="text-xs text-muted-foreground"> {selected?.unitAbbrev}</span>
                </div>
                <Numpad onKey={onNumpadKey} onEnter={commitEdit} />
                <Button className="w-full" onClick={commitEdit}>Listo</Button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onPointerDown={() => startRepeat(-(selected?.step ?? 0.01))}
                  onPointerUp={stopRepeat}
                  onPointerLeave={stopRepeat}
                  onPointerCancel={stopRepeat}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <Minus className="size-4" />
                </Button>
                <button type="button" onClick={startEdit} className="text-center active:scale-95">
                  <span className="block text-2xl font-bold tabular-nums">{round3(effectiveQty)}</span>
                  <span className="text-xs text-muted-foreground">{selected?.unitAbbrev} · tocar para editar</span>
                </button>
                <Button
                  variant="outline"
                  size="icon"
                  onPointerDown={() => startRepeat(selected?.step ?? 0.01)}
                  onPointerUp={stopRepeat}
                  onPointerLeave={stopRepeat}
                  onPointerCancel={stopRepeat}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            )
          ) : (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                ¿Cuánto quieres gastar? ($/{selected?.unitAbbrev})
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

          <div className="rounded-2xl border bg-card p-4 shadow-sm text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Precio</span>
              <span>
                {selected ? money(selected.price) : "—"}/{selected?.unitAbbrev}
              </span>
            </div>
            {available != null && (
              <div className="mt-1 flex justify-between text-muted-foreground">
                <span>Disponible</span>
                <span className={cn(effectiveQty > available && "font-semibold text-destructive")}>
                  {available} {selected?.unitAbbrev}
                </span>
              </div>
            )}
            <div className="mt-1 flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
          </div>
    </BottomSheet>
  );
}
