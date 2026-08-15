"use client";

import { useState } from "react";
import { BadgePercent, TicketPercent, X } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { usePosStore } from "@/stores/pos-store";
import { usePosTotals } from "@/hooks/use-pos-totals";
import { money } from "@/lib/pos/money";
import { useSupervisor } from "./supervisor-gate";
import { POS_MANUAL_DISCOUNT_LIMIT_PERCENT } from "@/lib/pos/config";
import { cn } from "@/lib/utils";

interface DiscountDialogProps {
  open: boolean;
  onClose: () => void;
}

export function DiscountDialog({ open, onClose }: DiscountDialogProps) {
  const manualDiscount = usePosStore((s) => s.manualDiscount);
  const setManualDiscount = usePosStore((s) => s.setManualDiscount);
  const coupon = usePosStore((s) => s.coupon);
  const customerId = usePosStore((s) => s.customerId);
  const applyCoupon = usePosStore((s) => s.applyCoupon);
  const clearCoupon = usePosStore((s) => s.clearCoupon);
  const couponPending = usePosStore((s) => s.couponPending);
  const couponError = usePosStore((s) => s.couponError);
  const { requestSupervisor } = useSupervisor();

  const t = usePosTotals();
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  const [code, setCode] = useState(coupon.code);
  const [couponLoading, setCouponLoading] = useState(false);

  const applyManual = async () => {
    const num = parseFloat(value.replace(",", "."));
    if (isNaN(num) || num <= 0) return;
    const actual = kind === "percent" ? Math.min(100, num) : Math.min(t.subtotal, num);
    if (kind === "percent" && actual > POS_MANUAL_DISCOUNT_LIMIT_PERCENT) {
      const ok = await requestSupervisor(`Descuento manual del ${actual}%`);
      if (!ok) return;
    }
    setManualDiscount(actual > 0 ? { kind, value: actual } : null);
    onClose();
  };

  const validateCoupon = async () => {
    if (!code.trim()) return;
    setCouponLoading(true);
    couponPending();
    try {
      const res = await fetch("/api/pos/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase(), customerId: customerId ?? undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        applyCoupon({
          code: code.trim().toUpperCase(),
          label: data.label,
          amount: data.amount ?? 0,
          percent: data.percent,
          couponId: data.couponId,
          promotionId: data.promotionId,
        });
        onClose();
      } else {
        couponError(data.error ?? "Cupón no válido");
      }
    } catch {
      couponError("Error al validar el cupón");
    } finally {
      setCouponLoading(false);
    }
  };

  const manualAmount =
    manualDiscount?.kind === "percent"
      ? money((t.subtotal * manualDiscount.value) / 100)
      : money(manualDiscount?.value ?? 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TicketPercent className="size-5 text-primary" /> Descuentos y cupones
          </DialogTitle>
          <DialogDescription>Aplica un descuento manual o un código de cupón.</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Descuento manual
            </p>
            <div className="grid grid-cols-2 gap-1 rounded-xl border bg-muted/40 p-1">
              {(["percent", "amount"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={cn(
                    "rounded-lg px-2 py-1.5 text-xs font-semibold transition",
                    kind === k ? "bg-background shadow-sm" : "text-muted-foreground"
                  )}
                >
                  {k === "percent" ? "Porcentaje %" : "Monto $"}
                </button>
              ))}
            </div>

            {manualDiscount ? (
              <div className="flex items-center justify-between rounded-xl border bg-emerald-500/10 px-3 py-2 text-sm">
                <span className="font-medium">
                  {manualDiscount.kind === "percent" ? `${manualDiscount.value}%` : money(manualDiscount.value)}
                </span>
                <span className="tabular-nums font-semibold">-{manualAmount}</span>
                <Button variant="ghost" size="icon" onClick={() => setManualDiscount(null)} className="size-6">
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {[5, 10, 15].map((p) => (
                  <Button
                    key={p}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setKind("percent");
                      setValue(String(p));
                    }}
                  >
                    {p}%
                  </Button>
                ))}
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={kind === "percent" ? "0-100" : "0.00"}
                  inputMode="decimal"
                  className="h-9"
                />
              </div>
            )}

            {!manualDiscount && (
              <Button onClick={applyManual} className="w-full" disabled={!value}>
                <BadgePercent className="size-4" />
                Aplicar descuento
              </Button>
            )}
            <p className="text-[11px] text-muted-foreground">
              Descuentos mayores al {POS_MANUAL_DISCOUNT_LIMIT_PERCENT}% requieren aprobación de supervisor.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Código de cupón
            </p>
            {coupon.status === "applied" && coupon.result ? (
              <div className="flex items-center justify-between rounded-xl border bg-primary/10 px-3 py-2 text-sm">
                <span className="font-medium">{coupon.result.label}</span>
                <span className="tabular-nums font-semibold">-{money(t.discounts.filter((d) => d.kind === "coupon").reduce((a, d) => a + d.amount, 0))}</span>
                <Button variant="ghost" size="icon" onClick={() => clearCoupon()} className="size-6">
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="CÓDIGO-123"
                  className="uppercase"
                  onKeyDown={(e) => e.key === "Enter" && validateCoupon()}
                />
                <Button onClick={validateCoupon} disabled={couponLoading || !code.trim()}>
                  {couponLoading ? "…" : "Validar"}
                </Button>
              </div>
            )}
            {coupon.status === "error" && (
              <p className="text-xs text-destructive">{coupon.error}</p>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}