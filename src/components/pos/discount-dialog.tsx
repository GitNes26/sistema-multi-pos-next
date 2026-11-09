"use client";

import { useEffect, useState } from "react";
import { BadgePercent, Gift, ShieldCheck, TicketPercent, X } from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { usePosStore } from "@/stores/pos-store";
import { usePosTotals } from "@/hooks/use-pos-totals";
import { money } from "@/lib/pos/money";
import { useSupervisor } from "./supervisor-gate";
import { POS_MANUAL_DISCOUNT_LIMIT_PERCENT } from "@/lib/pos/config";
import { cn } from "@/lib/utils";
import { redemptionAmount } from "@/lib/loyalty/redeem";

interface WarrantyInfo {
  saleId: string;
  saleNumber: string;
  createdAt: string;
  customerName: string | null;
  offers: { ruleId: string; name: string; discountPercent: number; coversProductIds: string[]; expiresAt: string; legend: string; claimStatus: string }[];
}

interface CustomerProgram {
  programId: string;
  name: string;
  kind: "visit_card" | "prepaid_pack";
  credits: number;
  visits: number;
  visitsRequired: number | null;
  targetProductIds: string[];
  excludeProductIds: string[];
  discountPercent: number;
  membership?: { status: "none" | "active" | "expired"; daysLeft: number | null; expiresAt: string | null; feeProductId: string | null; price: number | null; autoRenew: boolean } | null;
}

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
  const items = usePosStore((s) => s.items);
  const loyaltyRedeems = usePosStore((s) => s.loyaltyRedeems);
  const toggleLoyaltyRedeem = usePosStore((s) => s.toggleLoyaltyRedeem);
  const warrantyRedeems = usePosStore((s) => s.warrantyRedeems);
  const toggleWarrantyRedeem = usePosStore((s) => s.toggleWarrantyRedeem);
  const addProduct = usePosStore((s) => s.addProduct);
  const catalogProducts = usePosStore((s) => s.products);
  const locationId = usePosStore((s) => s.location.id);
  const [ticketNo, setTicketNo] = useState("");
  const [warranty, setWarranty] = useState<WarrantyInfo | null>(null);
  const [warrantyError, setWarrantyError] = useState<string | null>(null);
  const [warrantyLoading, setWarrantyLoading] = useState(false);
  const [warrantyEnabled, setWarrantyEnabled] = useState(false);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/pos/warranty?enabled=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setWarrantyEnabled(Boolean(d.ok && d.enabled)); })
      .catch(() => { if (!cancelled) setWarrantyEnabled(false); });
    return () => { cancelled = true; };
  }, [open]);

  // Garantía de servicio: el cliente presenta su ticket (físico o desde el portal) y se busca por su número.
  const lookupWarranty = async () => {
    if (!ticketNo.trim()) return;
    setWarrantyLoading(true);
    setWarrantyError(null);
    setWarranty(null);
    try {
      const res = await fetch(`/api/pos/warranty?saleNumber=${encodeURIComponent(ticketNo.trim())}&locationId=${encodeURIComponent(locationId)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo buscar el ticket");
      setWarranty(data);
    } catch (err) {
      setWarrantyError(err instanceof Error ? err.message : "No se pudo buscar el ticket");
    } finally {
      setWarrantyLoading(false);
    }
  };
  const [programs, setPrograms] = useState<CustomerProgram[]>([]);

  // Créditos de fidelidad del cliente del ticket (el servidor los vuelve a validar al cobrar).
  useEffect(() => {
    if (!open || !customerId) {
      setPrograms([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/pos/loyalty?customerId=${encodeURIComponent(customerId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setPrograms(d.programs); })
      .catch(() => { if (!cancelled) setPrograms([]); });
    return () => { cancelled = true; };
  }, [open, customerId]);

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
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      icon={<TicketPercent className="size-5 text-primary" />}
      title="Descuentos y cupones"
      description="Aplica un descuento manual, un cupón o una recompensa del cliente."
      className="sm:max-w-sm"
      bodyClassName="space-y-4"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
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
              <div className="flex items-center justify-between rounded-xl border bg-success/10 px-3 py-2 text-sm">
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
            <p className="text-xs text-muted-foreground">
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

          {warrantyEnabled && <Separator />}
          {warrantyEnabled && <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="size-3.5" /> Garantía de servicio
            </p>
            <div className="flex gap-2">
              <Input value={ticketNo} onChange={(e) => setTicketNo(e.target.value)} placeholder="Número del ticket (#123)" inputMode="numeric" onKeyDown={(e) => e.key === "Enter" && lookupWarranty()} aria-label="Número del ticket original" />
              <Button onClick={lookupWarranty} disabled={warrantyLoading || !ticketNo.trim()}>{warrantyLoading ? "…" : "Buscar"}</Button>
            </div>
            {warrantyError && <p className="text-xs text-destructive">{warrantyError}</p>}
            {warranty && warranty.offers.length === 0 && (
              <p className="text-xs text-muted-foreground">El ticket {warranty.saleNumber} no tiene garantías vigentes (fuera de plazo, ya usada o sin servicios cubiertos).</p>
            )}
            {warranty?.offers.map((o) => {
              const active = warrantyRedeems.some((r) => r.ruleId === o.ruleId && r.saleId === warranty.saleId);
              const lines = items.filter((i) => i.qty >= 1).map((i) => ({ productId: i.productId, unitPrice: i.unitPrice }));
              const amount = redemptionAmount(lines, o.coversProductIds, o.discountPercent);
              return (
                <div key={o.ruleId} className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{o.name}{warranty.customerName ? ` · ${warranty.customerName}` : ""}</p>
                    <p className="text-xs text-muted-foreground">
                      {amount > 0 ? `−${money(amount)} · ${o.discountPercent >= 100 ? "sin costo" : `${o.discountPercent}%`}` : "Agrega al ticket el servicio que cubre la garantía"}
                      {o.claimStatus === "requested" ? " · pedida desde el portal" : ""}
                    </p>
                  </div>
                  <Button size="sm" variant={active ? "secondary" : "outline"} disabled={amount <= 0 && !active} onClick={() => toggleWarrantyRedeem({ ruleId: o.ruleId, saleId: warranty.saleId, label: `${o.name} (${warranty.saleNumber})`, coversProductIds: o.coversProductIds, percent: o.discountPercent })}>
                    {active ? "Quitar" : "Aplicar"}
                  </Button>
                </div>
              );
            })}
          </div>}

          {customerId && programs.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Gift className="size-3.5" /> Recompensas del cliente
                </p>
                {programs.map((p) => {
                  const lines = items.filter((i) => i.qty >= 1).map((i) => ({ productId: i.productId, unitPrice: i.unitPrice }));
                  const amount = redemptionAmount(lines, p.targetProductIds, p.discountPercent, p.excludeProductIds);
                  const active = loyaltyRedeems.some((r) => r.programId === p.programId);
                  const canUse = p.credits > 0 && amount > 0;
                  return (
                    <div key={p.programId} className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.membership && p.membership.status !== "active"
                            ? p.membership.status === "expired" ? "Membresía vencida: renueva su cuota para que vuelva a tener servicios" : "Sin membresía"
                            : p.credits > 0
                            ? `${p.credits} ${p.credits === 1 ? "crédito" : "créditos"} disponible${p.credits === 1 ? "" : "s"}${p.membership?.daysLeft != null ? ` · vence en ${p.membership.daysLeft} d` : ""}${canUse ? ` · −${money(amount)}` : " · agrega un servicio elegible"}`
                            : p.kind === "visit_card" && p.visitsRequired
                              ? `Lleva ${p.visits} de ${p.visitsRequired} visitas`
                              : "Sin créditos"}
                        </p>
                      </div>
                      {p.membership?.feeProductId && (p.membership.status !== "active" || (p.membership.daysLeft ?? 99) <= 7) && (() => {
                        // Cuota de la membresía: se cobra como cualquier producto y al cobrar da de alta o renueva el periodo.
                        const fee = catalogProducts.find((c) => c.productId === p.membership!.feeProductId);
                        const inTicket = items.some((i) => i.productId === p.membership!.feeProductId);
                        return (
                          <Button size="sm" disabled={!fee || inTicket} onClick={() => { if (fee) { addProduct(fee); onClose(); } }} title={fee ? undefined : "El producto de la cuota no está disponible en el catálogo del POS"}>
                            {inTicket ? "Cuota en el ticket" : p.membership.status === "active" ? "Renovar cuota" : "Cobrar cuota"}{p.membership.price !== null && !inTicket ? ` ${money(p.membership.price)}` : ""}
                          </Button>
                        );
                      })()}
                      {p.credits > 0 && (
                        <Button
                          size="sm"
                          variant={active ? "secondary" : "outline"}
                          disabled={!canUse && !active}
                          onClick={() => toggleLoyaltyRedeem({ programId: p.programId, label: p.name, targetProductIds: p.targetProductIds, excludeProductIds: p.excludeProductIds, percent: p.discountPercent })}
                        >
                          {active ? "Quitar" : "Canjear"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
    </DialogComponent>
  );
}