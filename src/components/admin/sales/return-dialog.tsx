"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { salesApi, type SaleDetail, type SaleReturn } from "@/lib/api";
import {
  Dialog,
  DialogComponent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Undo2 } from "lucide-react";

const RETURN_TYPES = [
  { value: "refund", label: "Devolución de dinero", desc: "Se reembolsa el efectivo/tarjeta al cliente" },
  { value: "coupon", label: "Cupón de descuento", desc: "Se genera un cupón para uso futuro" },
  { value: "points", label: "Bonificar puntos", desc: "Se bonifica el monto como puntos lealtad" },
  { value: "exchange", label: "Cambio por otro producto", desc: "Se reemplaza el producto defectuoso" },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: SaleDetail;
  onCreated?: () => void;
}

export function ReturnDialog({ open, onOpenChange, sale, onCreated }: Props) {
  const [returnType, setReturnType] = useState<string>("refund");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [itemReasons, setItemReasons] = useState<Record<string, string>>({});
  const [restockable, setRestockable] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [existingReturns, setExistingReturns] = useState<SaleReturn[]>([]);

  // Cargar devoluciones existentes
  useEffect(() => {
    if (open && sale.id) {
      salesApi.saleReturns(sale.id).then((res) => {
        if (res.ok) setExistingReturns(res.returns);
      });
    }
  }, [open, sale.id]);

  // Calcular cuánto se ha devuelto de cada item
  const getReturnedQty = useCallback(
    (saleItemId: string) =>
      existingReturns
        .filter((r) => r.status !== "rejected")
        .reduce((acc, ret) => {
          const ri = ret.items.find((i) => i.saleItemId === saleItemId);
          return acc + (ri ? ri.quantity : 0);
        }, 0),
    [existingReturns]
  );

  const handleToggleItem = (saleItemId: string, maxQty: number) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[saleItemId]) {
        delete next[saleItemId];
      } else {
        next[saleItemId] = maxQty;
      }
      return next;
    });
  };

  const handleQtyChange = (saleItemId: string, qty: number) => {
    setSelectedItems((prev) => ({ ...prev, [saleItemId]: Math.max(0, qty) }));
  };

  const selectedTotal = Object.entries(selectedItems).reduce((acc, [itemId, qty]) => {
    const item = sale.items.find((i) => i.id === itemId);
    if (!item || qty <= 0) return acc;
    return acc + qty * Number(item.unitPrice);
  }, 0);

  const handleSubmit = async () => {
    const items = Object.entries(selectedItems)
      .filter(([, qty]) => qty > 0)
      .map(([saleItemId, quantity]) => {
        const item = sale.items.find((i) => i.id === saleItemId)!;
        const returned = getReturnedQty(saleItemId);
        const maxReturnable = Number(item.quantity) - returned;
        return {
          saleItemId,
          quantity: Math.min(quantity, maxReturnable),
          reason: itemReasons[saleItemId] || undefined,
          restockable: restockable[saleItemId] ?? true,
        };
      });

    if (items.length === 0) {
      toast.error("Selecciona al menos un producto para devolver");
      return;
    }

    setLoading(true);
    try {
      const res = await salesApi.createReturn(sale.id, {
        returnType: returnType as "exchange" | "refund" | "coupon" | "points",
        reason: reason || undefined,
        notes: notes || undefined,
        items,
      });
      if (res.ok) {
        toast.success("Devolución creada correctamente");
        onOpenChange(false);
        setSelectedItems({});
        setReason("");
        setNotes("");
        onCreated?.();
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al crear devolución");
    } finally {
      setLoading(false);
    }
  };

  const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Undo2 className="size-5" />
          Nueva devolución — Venta #{String(sale.locationSaleNumber ?? sale.saleNumber)}
        </DialogTitle>
      </DialogHeader>
      <DialogBody className="space-y-5 max-h-[60vh] overflow-y-auto">
        {/* Tipo de devolución */}
        <div className="space-y-2">
          <Label>Tipo de resolución</Label>
          <RadioGroup value={returnType} onValueChange={setReturnType} className="grid grid-cols-2 gap-2">
            {RETURN_TYPES.map((t) => (
              <label
                key={t.value}
                className={`flex flex-col rounded-lg border p-3 cursor-pointer transition-colors ${
                  returnType === t.value ? "border-primary bg-primary/5" : "hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value={t.value} />
                  <span className="text-sm font-medium">{t.label}</span>
                </div>
                <span className="text-xs text-muted-foreground ml-6">{t.desc}</span>
              </label>
            ))}
          </RadioGroup>
        </div>

        {/* Productos */}
        <div className="space-y-2">
          <Label>Productos a devolver</Label>
          <div className="space-y-2">
            {sale.items.map((item) => {
              const returned = getReturnedQty(item.id);
              const maxReturnable = Number(item.quantity) - returned;
              if (maxReturnable <= 0) return null;
              const isSelected = !!selectedItems[item.id];

              return (
                <div
                  key={item.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleItem(item.id, maxReturnable)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium truncate">{item.productName}</p>
                          {item.variantName && (
                            <p className="text-xs text-muted-foreground">{item.variantName}</p>
                          )}
                        </div>
                        <span className="text-sm font-medium tabular-nums">
                          {money(Number(item.unitPrice))}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Vendidos: {Number(item.quantity)} · Ya devueltos: {returned} · Disponible: {maxReturnable}
                      </p>

                      {isSelected && (
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs">Cantidad:</Label>
                            <Input
                              type="number"
                              min={1}
                              max={maxReturnable}
                              value={selectedItems[item.id] ?? maxReturnable}
                              onChange={(e) => handleQtyChange(item.id, Number(e.target.value))}
                              className="h-8 w-20 text-xs"
                            />
                            <span className="text-xs text-muted-foreground">
                              = {money((selectedItems[item.id] ?? maxReturnable) * Number(item.unitPrice))}
                            </span>
                          </div>
                          <Input
                            placeholder="Motivo de devolución de este producto..."
                            value={itemReasons[item.id] ?? ""}
                            onChange={(e) =>
                              setItemReasons((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            className="h-8 text-xs"
                          />
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox
                              checked={restockable[item.id] ?? true}
                              onCheckedChange={(c) =>
                                setRestockable((prev) => ({ ...prev, [item.id]: c === true }))
                              }
                            />
                            Re-estacionar (devolver al stock)
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Motivo general */}
        <div className="space-y-2">
          <Label>Motivo general (opcional)</Label>
          <Input
            placeholder="Ej: Producto defectuoso, error en pedido..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Notas internas (opcional)</Label>
          <Textarea
            placeholder="Notas para el equipo..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {/* Resumen */}
        {Object.keys(selectedItems).length > 0 && (
          <div className="rounded-lg bg-muted p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Total a devolver:</span>
              <span className="font-bold text-lg tabular-nums">{money(selectedTotal)}</span>
            </div>
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading || Object.keys(selectedItems).length === 0}
        >
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          Crear devolución
        </Button>
      </DialogFooter>
    </DialogComponent>
  );
}
