"use client";

import { useEffect, useMemo, useState } from "react";
import { Scale } from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Numpad, type NumpadKey } from "./numpad";
import type { PosProduct } from "@/types/pos";
import { money, qty, round2, clamp, snapToStep } from "@/lib/pos/money";
import { cn } from "@/lib/utils";

interface BulkUnit {
  id: string;
  name: string;
  abbrev: string;
  price: number;
}

export interface BulkDraft {
  qty: number;
  unitId: string;
  pricePerUnit: number;
  abbrev: string;
  unitName: string;
}

interface BulkModalProps {
  open: boolean;
  product: PosProduct | null;
  editing?: { key: string; draft: BulkDraft } | null;
  onClose: () => void;
  onConfirm: (product: PosProduct, draft: BulkDraft, editingKey?: string) => void;
}

type EntryMode = "cantidad" | "monto";

export function BulkModal({ open, product, editing, onClose, onConfirm }: BulkModalProps) {
  const [qtyStr, setQtyStr] = useState("1");
  const [amountStr, setAmountStr] = useState("");
  const [mode, setMode] = useState<EntryMode>("cantidad");
  const [unitId, setUnitId] = useState<string>("");

  useEffect(() => {
    if (!product) return;
    const bulk = product.bulk!;
    setUnitId(editing?.draft.unitId ?? bulk.unitId);
    setQtyStr(String(editing?.draft.qty ?? "1"));
    setAmountStr("");
    setMode("cantidad");
  }, [product, editing]);

  const units = useMemo<BulkUnit[]>(() => {
    if (!product?.bulk) return [];
    const list: BulkUnit[] = [
      {
        id: product.bulk.unitId,
        name: product.bulk.unitName,
        abbrev: product.bulk.unitAbbrev,
        price: product.price,
      },
    ];
    if (product.bulk.allowSplit && product.bulk.split) {
      list.push({
        id: product.bulk.split.unitId,
        name: product.bulk.split.unitName,
        abbrev: product.bulk.split.unitAbbrev,
        price: product.bulk.split.price,
      });
    }
    return list;
  }, [product]);

  if (!product?.bulk) return null;

  const bulk = product.bulk;
  const minQty = bulk.minQty > 0 ? bulk.minQty : 0.01;
  const step = bulk.step > 0 ? bulk.step : 0.01;
  const maxQty = bulk.maxQty > 0 ? bulk.maxQty : Infinity;

  const activeUnit = units.find((u) => u.id === unitId) ?? units[0];
  const pricePerUnit = activeUnit?.price ?? product.price;
  const abbrev = activeUnit?.abbrev ?? bulk.unitAbbrev;
  const unitName = activeUnit?.name ?? bulk.unitName;

  const parsedQty = Math.max(0, parseFloat(qtyStr.replace(",", ".")) || 0);
  const snappedQty = snapToStep(parsedQty, step);
  const qtyClamped = clamp(snappedQty, minQty, maxQty);

  const parsedAmount = Math.max(0, parseFloat(amountStr.replace(",", ".")) || 0);
  const qtyFromAmount = pricePerUnit > 0 ? snapToStep(parsedAmount / pricePerUnit, step) : 0;
  const liveQty = mode === "cantidad" ? qtyClamped : qtyFromAmount;
  const liveAmount = mode === "cantidad" ? round2(parsedQty * pricePerUnit) : parsedAmount;

  const onKey = (key: NumpadKey) => {
    const field = mode === "cantidad" ? setQtyStr : setAmountStr;
    const current = mode === "cantidad" ? qtyStr : amountStr;
    if (key === "clear") return field("");
    if (key === "backspace") return field(current.slice(0, -1));
    if (key === ".") {
      if (!current.includes(".")) field(current === "" ? "0." : current + ".");
      return;
    }
    const next = current + key;
    if (next.replace(".", "").length > 8) return;
    if (mode === "cantidad") {
      const v = parseFloat(next);
      if (!isNaN(v) && v > maxQty) return;
    }
    field(next);
  };

  const preset = (v: number) => {
    const snapped = clamp(snapToStep(v, step), minQty, maxQty);
    setQtyStr(String(snapped));
    setMode("cantidad");
  };

  const confirm = () => {
    const finalQty = clamp(snapToStep(liveQty, step), minQty, maxQty);
    if (finalQty <= 0) return;
    onConfirm(product, { qty: finalQty, unitId: activeUnit.id, pricePerUnit, abbrev, unitName }, editing?.key);
  };

  const presets = [minQty, 0.25, 0.5, 0.75, 1, 2].filter((v) => v >= minQty);

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      icon={<Scale className="size-5 text-violet-600" />}
      title={product.name}
      description={
        <>
          Precio: <span className="font-semibold text-foreground">{money(pricePerUnit)}</span> / {unitName} (min {minQty} {abbrev}, paso {step})
        </>
      }
      className="sm:max-w-sm"
      bodyClassName="space-y-3"
      footerClassName="gap-2"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={confirm} size="lg" className="flex-1">
            {editing ? "Guardar cambios" : `Agregar · ${money(liveAmount)}`}
          </Button>
        </>
      }
    >
          {units.length > 1 && (
          <div className="flex items-center gap-1 rounded-xl border bg-muted/40 p-1">
            {units.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setUnitId(u.id)}
                className={cn(
                  "flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition",
                  u.id === activeUnit.id ? "bg-background shadow-sm" : "text-muted-foreground"
                )}
              >
                {u.name} · {money(u.price)}/{u.abbrev}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-1 rounded-xl border bg-muted/40 p-1">
          {(["cantidad", "monto"] as EntryMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-lg px-2 py-1.5 text-xs font-semibold transition",
                mode === m ? "bg-background shadow-sm" : "text-muted-foreground"
              )}
            >
              {m === "cantidad" ? `Por cantidad (${abbrev})` : "Por monto ($)"}
            </button>
          ))}
        </div>

        <div className="rounded-xl border bg-card p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{mode === "cantidad" ? `Cantidad en ${abbrev}` : "Monto deseado"}</span>
            <Badge variant="secondary">{liveQty > 0 ? `${qty(liveQty)} ${abbrev}` : "—"}</Badge>
          </div>
          <p className="mt-1 text-center text-3xl font-bold tabular-nums">
            {mode === "cantidad"
              ? <>{qty(parsedQty)} <span className="text-lg font-medium text-muted-foreground">{abbrev}</span></>
              : money(liveAmount)
            }
          </p>
          {mode === "cantidad" && (
            <p className="text-center text-xs text-muted-foreground">
              {qty(parsedQty)} {abbrev} × {money(pricePerUnit)}/{abbrev} = {money(round2(parsedQty * pricePerUnit))}
            </p>
          )}
          {mode === "monto" && (
            <p className="text-center text-xs text-muted-foreground">
              ≈ {qty(qtyFromAmount)} {abbrev}
            </p>
          )}
        </div>

        {mode === "cantidad" && (
          <div className="flex flex-wrap gap-1.5">
            {presets.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => preset(v)}
                className="rounded-full border px-2.5 py-1 text-xs transition hover:bg-muted"
              >
                {v} {abbrev}
              </button>
            ))}
          </div>
        )}

          <Numpad onKey={onKey} onEnter={confirm} />
    </DialogComponent>
  );
}