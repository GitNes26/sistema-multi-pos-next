"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Banknote, CreditCard, Globe, LocateFixed, MapPin, Store, Truck, Clock, AlertTriangle, ShoppingBag, CircleCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePortalStore, cartSubtotal, cartTax } from "@/stores/portal-store";
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
import { SwipeableRow } from "@/components/shared/swipeable-row";
import { cn } from "@/lib/utils";

export function CheckoutClient() {
  const router = useRouter();
  const items = usePortalStore((s) => s.items);
  const clearCart = usePortalStore((s) => s.clearCart);
  const removeItem = usePortalStore((s) => s.removeItem);

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
      <div className="flex flex-col items-center gap-4 p-10 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <ShoppingBag className="size-8 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">Tu carrito está vacío</p>
          <p className="text-sm text-muted-foreground">Agrega productos antes de continuar</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/portal/store")}>
          Ir a la tienda
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex size-10 items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted/80 active:scale-95"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold">Finalizar pedido</h1>
          <p className="text-xs text-muted-foreground">{items.length} producto(s) en tu carrito</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          {/* Entrega */}
          <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="size-4 text-primary" /> ¿Cómo lo quieres recibir?
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeliveryMethod("pickup")}
                disabled={pickupLocations.length === 0 || (policy !== null && !policy.pickupEnabled)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border-2 p-4 text-sm font-medium transition-all active:scale-[0.97]",
                  deliveryMethod === "pickup"
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                <Store className="size-6" /> Recoger
                {policy?.pickupFeeEnabled && policy.pickupFee > 0 && (
                  <span className="text-[11px] text-muted-foreground">{money(policy.pickupFee)}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMethod("delivery")}
                disabled={policy !== null && !policy.deliveryEnabled}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border-2 p-4 text-sm font-medium transition-all active:scale-[0.97]",
                  deliveryMethod === "delivery"
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                <Truck className="size-6" /> Domicilio
                {policy?.deliveryFeeEnabled && policy.deliveryFee > 0 && (
                  <span className="text-[11px] text-muted-foreground">{money(policy.deliveryFee)}</span>
                )}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {deliveryMethod === "pickup" && (
                <motion.div
                  key="pickup"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <RadioGroup value={locationId} onValueChange={setLocationId} className="space-y-2 pt-1">
                    {pickupLocations.map((l) => (
                      <Label
                        key={l.id}
                        htmlFor={`loc-${l.id}`}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-all",
                          locationId === l.id ? "border-primary bg-primary/5" : "border-transparent bg-muted/50"
                        )}
                      >
                        <RadioGroupItem value={l.id} id={`loc-${l.id}`} className="mt-0.5" />
                        <div className="flex-1">
                          <span className="block text-sm font-medium">{l.name}</span>
                          {l.address && <span className="block text-xs text-muted-foreground">{l.address}</span>}
                          {l.openingHours && <span className="block text-xs text-muted-foreground">{l.openingHours}</span>}
                        </div>
                      </Label>
                    ))}
                  </RadioGroup>
                </motion.div>
              )}

              {deliveryMethod === "delivery" && (
                <motion.div
                  key="delivery"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden pt-1"
                >
                  <InputGroupField
                    placeholder="Calle, número, colonia, ciudad…"
                    leftIcon={<MapPin className="size-4" />}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                  <Button type="button" variant="outline" size="sm" className="w-full" onClick={useCurrentLocation}>
                    <LocateFixed className="size-4" /> {coords ? "Ubicación capturada ✓" : "Usar mi ubicación (GPS)"}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Pago */}
          <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CreditCard className="size-4 text-primary" /> Método de pago
            </h2>
            <RadioGroup
              value={payMethod}
              onValueChange={(v) => setPayMethod(v as "cash" | "card" | "online")}
              className="space-y-2"
            >
              <Label
                htmlFor="pay-cash"
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-all",
                  payMethod === "cash" ? "border-primary bg-primary/5" : "border-transparent bg-muted/50"
                )}
              >
                <RadioGroupItem value="cash" id="pay-cash" />
                <Banknote className="size-5 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium">Pagar en sucursal</span>
              </Label>

              <Label
                htmlFor="pay-online"
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-all",
                  payMethod === "online" ? "border-primary bg-primary/5" : "border-transparent bg-muted/50"
                )}
              >
                <RadioGroupItem value="online" id="pay-online" />
                <Globe className="size-5 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium">Pagar en línea</span>
              </Label>

              {methods.length > 0 && (
                <Label
                  htmlFor="pay-card"
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-all",
                    payMethod === "card" ? "border-primary bg-primary/5" : "border-transparent bg-muted/50"
                  )}
                >
                  <RadioGroupItem value="card" id="pay-card" />
                  <CreditCard className="size-5 text-muted-foreground" />
                  <span className="flex-1 text-sm font-medium">
                    {selectedCard?.alias
                      ? `${selectedCard.alias} •••• ${selectedCard.last4}`
                      : `Tarjeta •••• ${selectedCard?.last4 ?? ""}`}
                  </span>
                </Label>
              )}
            </RadioGroup>
          </section>

          {/* Resumen */}
          <section className="rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ShoppingBag className="size-4 text-primary" /> Resumen
            </h2>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {items.map((i) => (
                <SwipeableRow key={i.key} onDelete={() => removeItem(i.key)}>
                  <div className="flex justify-between py-1.5 text-sm">
                    <span className="min-w-0 truncate pr-2">
                      {i.qty}× {i.name}
                      {i.variantName ? ` (${i.variantName})` : ""}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{money(i.unitPrice * i.qty)}</span>
                  </div>
                </SwipeableRow>
              ))}
            </div>

            <div className="mt-2 space-y-1.5 border-t pt-2 text-sm">
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
                    {deliveryMethod === "delivery" ? "Envío" : "Cargo por recoger"}
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
              <div className="flex justify-between border-t pt-2 text-base font-bold">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>
          </section>

          <Textarea
            placeholder="Notas para tu pedido (opcional)…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded-2xl"
          />

          {/* Submit — fixed at bottom on mobile */}
          <div className="sticky bottom-0 -mx-4 bg-background px-4 pt-3 pb-4">
            <Button
              className="h-14 w-full rounded-2xl text-base font-bold shadow-lg"
              onClick={submit}
              disabled={submitting || !!minAmountError}
            >
              <CircleCheck className="mr-2 size-5" />
              {submitting ? "Procesando…" : `Confirmar pedido · ${money(total)}`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
