"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CreditCard, Globe, LocateFixed, MapPin, Store, Truck, Clock, AlertTriangle } from "lucide-react";
import { usePortalStore, cartSubtotal, cartTax, cartTotal } from "@/stores/portal-store";
import { portalApi } from "@/lib/portal/client";
import { paymentsApi } from "@/lib/payments/client";
import type { PortalLocation, PaymentMethodView } from "@/lib/portal/server";
import type { DeliveryPolicyData } from "@/lib/orders/server";
import { money } from "@/lib/pos/money";
import { swalError, swalLoading, swalClose } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { InputGroupField } from "@/components/base/input-group-field";
import { cn } from "@/lib/utils";

export function CheckoutClient() {
  const router = useRouter();
  const items = usePortalStore((s) => s.items);
  const clearCart = usePortalStore((s) => s.clearCart);

  const [locations, setLocations] = useState<PortalLocation[]>([]);
  const [methods, setMethods] = useState<PaymentMethodView[]>([]);
  const [policy, setPolicy] = useState<DeliveryPolicyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "delivery">("pickup");
  const [locationId, setLocationId] = useState<string>("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "online">("cash");
  const [cardId, setCardId] = useState<string>("");
  const [notes, setNotes] = useState("");

  const subtotal = cartSubtotal(items);
  const tax = cartTax(items);

  const deliveryFee = useMemo(() => {
    if (!policy) return 0;
    if (deliveryMethod === "pickup") {
      if (!policy.pickupFeeEnabled) return 0;
      return policy.pickupFee;
    }
    if (!policy.deliveryFeeEnabled) return 0;
    return policy.deliveryFee;
  }, [policy, deliveryMethod]);

  const total = subtotal + tax + deliveryFee;

  const scheduleInfo = useMemo(() => {
    if (!policy) return null;
    const schedule = deliveryMethod === "pickup" ? policy.pickupSchedule : policy.deliverySchedule;
    if (!schedule || schedule.length === 0) return null;
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Mexico_City",
    });
    const parts = formatter.formatToParts(now);
    const dayStr = parts.find((p) => p.type === "weekday")?.value ?? "";
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    const currentMinutes = hour * 60 + minute;
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const today = dayMap[dayStr] ?? 0;
    const todaySchedule = schedule.find((s) => s.day === today);
    if (!todaySchedule || !todaySchedule.enabled) return { open: false, message: "Cerrado hoy" };
    const [openH, openM] = todaySchedule.open.split(":").map(Number);
    const [closeH, closeM] = todaySchedule.close.split(":").map(Number);
    const isOpen = currentMinutes >= openH * 60 + openM && currentMinutes < closeH * 60 + closeM;
    return { open: isOpen, message: isOpen ? `Abierto hasta ${todaySchedule.close}` : `Abre a las ${todaySchedule.open}` };
  }, [policy, deliveryMethod]);

  const minAmount = useMemo(() => {
    if (!policy) return null;
    return deliveryMethod === "pickup" ? policy.pickupMinAmount : policy.deliveryMinAmount;
  }, [policy, deliveryMethod]);

  const minAmountError = useMemo(() => {
    if (!minAmount || subtotal >= minAmount) return null;
    return `Monto minimo: ${money(minAmount)}`;
  }, [minAmount, subtotal]);

  useEffect(() => {
    let active = true;
    Promise.all([portalApi.locations(), portalApi.paymentMethods(), portalApi.deliveryPolicy()])
      .then(([l, m, p]) => {
        if (!active) return;
        setLocations(l.locations);
        setMethods(m.methods);
        setPolicy(p.policy);
        const pickupLoc = l.locations.find((x) => x.allowsPickup);
        setLocationId(pickupLoc?.id ?? "");
        if (l.locations.every((x) => !x.allowsPickup)) setDeliveryMethod("delivery");
      })
      .catch(() => undefined)
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const pickupLocations = useMemo(() => locations.filter((l) => l.allowsPickup), [locations]);
  const selectedCard = methods.find((m) => m.id === cardId) ?? methods[0];

  useEffect(() => {
    if (!cardId && methods.length) setCardId(methods[0].id);
  }, [methods, cardId]);

  const useCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      swalError("Tu navegador no soporta geolocalización");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => swalError("No se pudo obtener tu ubicación")
    );
  };

  const submit = async () => {
    if (deliveryMethod === "pickup" && !locationId) {
      swalError("Selecciona una sucursal");
      return;
    }
    if (deliveryMethod === "delivery" && !address.trim()) {
      swalError("Ingresa una dirección de entrega");
      return;
    }

    swalLoading("Creando pedido…");
    setSubmitting(true);
    try {
      const order = await portalApi.createOrder({
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          productType: i.kind,
          productName: i.name,
          variantName: i.variantName,
          quantity: i.qty,
          unitId: i.unitId,
          unitPrice: i.unitPrice,
          lineTotal: i.unitPrice * i.qty,
          bulkQuantityDisplay: i.bulkQuantityDisplay ?? null,
          comment: i.comment ?? null,
        })),
        deliveryMethod,
        locationId: deliveryMethod === "pickup" ? locationId : null,
        address: deliveryMethod === "delivery" ? address : null,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        paymentMethod: payMethod === "cash" ? "cash" : "card",
        paymentReference:
          payMethod === "card" ? selectedCard?.last4 ?? null : payMethod === "online" ? "gateway" : null,
        subtotal,
        discount: 0,
        deliveryFee,
        total,
        notes: notes.trim() || null,
      });

      if (payMethod === "online") {
        const pay = await paymentsApi.payOrder(order.order.id);
        clearCart();
        swalClose();
        window.location.assign(pay.url);
        return;
      }

      clearCart();
      swalClose();
      router.push(`/portal/orders/${order.order.id}`);
    } catch (err) {
      swalClose();
      swalError("No se pudo crear el pedido", err instanceof Error ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center gap-3 p-10 text-center">
        <p className="text-sm text-muted-foreground">Tu carrito está vacío</p>
        <Button variant="outline" onClick={() => router.push("/portal/store")}>
          Ir a la tienda
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <h1 className="text-lg font-semibold">Finalizar pedido</h1>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          {/* Entrega */}
          <section className="space-y-3 rounded-xl border p-4">
            <h2 className="text-sm font-semibold">¿Cómo lo quieres recibir?</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeliveryMethod("pickup")}
                disabled={pickupLocations.length === 0 || (policy !== null && !policy.pickupEnabled)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-3 text-sm font-medium transition-colors disabled:opacity-40",
                  deliveryMethod === "pickup" ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Store className="size-5" /> Recoger en sucursal
                {policy?.pickupFeeEnabled && policy.pickupFee > 0 && (
                  <span className="text-[11px] text-muted-foreground">{money(policy.pickupFee)}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMethod("delivery")}
                disabled={policy !== null && !policy.deliveryEnabled}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-3 text-sm font-medium transition-colors disabled:opacity-40",
                  deliveryMethod === "delivery" ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Truck className="size-5" /> A domicilio
                {policy?.deliveryFeeEnabled && policy.deliveryFee > 0 && (
                  <span className="text-[11px] text-muted-foreground">{money(policy.deliveryFee)}</span>
                )}
              </button>
            </div>

            {deliveryMethod === "pickup" && (
              <RadioGroup value={locationId} onValueChange={setLocationId}>
                {pickupLocations.map((l) => (
                  <div key={l.id} className="flex items-start gap-2 rounded-lg border p-2.5">
                    <RadioGroupItem value={l.id} id={`loc-${l.id}`} className="mt-0.5" />
                    <Label htmlFor={`loc-${l.id}`} className="flex-1 cursor-pointer">
                      <span className="block text-sm font-medium">{l.name}</span>
                      {l.address && <span className="block text-xs text-muted-foreground">{l.address}</span>}
                      {l.openingHours && <span className="block text-xs text-muted-foreground">{l.openingHours}</span>}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {deliveryMethod === "delivery" && (
              <div className="space-y-2">
                <InputGroupField
                  placeholder="Calle, número, colonia, ciudad…"
                  leftIcon={<MapPin className="size-4" />}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
                <Button type="button" variant="outline" size="sm" onClick={useCurrentLocation}>
                  <LocateFixed className="size-4" /> {coords ? "Ubicación capturada" : "Usar mi ubicación (GPS)"}
                </Button>
              </div>
            )}
          </section>

          {/* Pago */}
          <section className="space-y-3 rounded-xl border p-4">
            <h2 className="text-sm font-semibold">Método de pago</h2>
            <RadioGroup
              value={payMethod}
              onValueChange={(v) => setPayMethod(v as "cash" | "card" | "online")}
            >
              <div className="flex items-center gap-2 rounded-lg border p-2.5">
                <RadioGroupItem value="cash" id="pay-cash" />
                <Label htmlFor="pay-cash" className="flex flex-1 cursor-pointer items-center gap-2">
                  <Banknote className="size-4 text-muted-foreground" />
                  <span className="text-sm">Pagar en sucursal</span>
                </Label>
              </div>

              <div className="flex items-center gap-2 rounded-lg border p-2.5">
                <RadioGroupItem value="online" id="pay-online" />
                <Label htmlFor="pay-online" className="flex flex-1 cursor-pointer items-center gap-2">
                  <Globe className="size-4 text-muted-foreground" />
                  <span className="text-sm">Pagar en línea (tarjeta)</span>
                </Label>
              </div>

              {methods.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg border p-2.5">
                  <RadioGroupItem value="card" id="pay-card" />
                  <Label htmlFor="pay-card" className="flex flex-1 cursor-pointer items-center gap-2">
                    <CreditCard className="size-4 text-muted-foreground" />
                    <span className="text-sm">
                      Tarjeta{" "}
                      {selectedCard?.alias
                        ? `${selectedCard.alias} (${selectedCard.brand ?? ""} •••• ${selectedCard.last4})`
                        : `${selectedCard?.brand ?? ""} •••• ${selectedCard?.last4}`}
                    </span>
                  </Label>
                </div>
              )}
            </RadioGroup>
          </section>

          {/* Resumen */}
          <section className="space-y-2 rounded-xl border p-4">
            <h2 className="text-sm font-semibold">Resumen</h2>
            <div className="max-h-48 space-y-1.5 overflow-y-auto">
              {items.map((i) => (
                <div key={i.key} className="flex justify-between text-sm">
                  <span className="min-w-0 truncate pr-2">
                    {i.qty}× {i.name}
                    {i.variantName ? ` (${i.variantName})` : ""}
                  </span>
                  <span className="shrink-0 tabular-nums">{money(i.unitPrice * i.qty)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1 border-t pt-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>IVA</span>
                <span>{money(tax)}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {deliveryMethod === "delivery" ? <Truck className="size-3.5" /> : <Store className="size-3.5" />}
                    {deliveryMethod === "delivery" ? "Envio" : "Cargo por recoger"}
                  </span>
                  <span>{money(deliveryFee)}</span>
                </div>
              )}
              {scheduleInfo && (
                <div className={cn("flex items-center gap-1.5 text-xs", scheduleInfo.open ? "text-emerald-600" : "text-amber-600")}>
                  <Clock className="size-3" />
                  {scheduleInfo.message}
                </div>
              )}
              {minAmountError && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="size-3" />
                  {minAmountError}
                </div>
              )}
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>
          </section>

          <Textarea
            placeholder="Notas para tu pedido (opcional)…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <Button className="w-full" size="lg" onClick={submit} disabled={submitting}>
            {submitting ? "Procesando…" : `Confirmar pedido · ${money(total)}`}
          </Button>
        </>
      )}
    </div>
  );
}
