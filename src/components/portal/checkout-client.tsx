"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Banknote, CreditCard, Globe, MapPin, Store, Truck, Clock, AlertTriangle, ShoppingBag, CircleCheck, Home, Plus, Trash2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePortalStore, cartSubtotal, cartTax } from "@/stores/portal-store";
import { portalApi, type LoyaltyData, type PortalPromotionPreview } from "@/lib/portal/client";
import { evaluatePortalPromotions } from "@/lib/portal/promo-engine";
import { paymentsApi } from "@/lib/payments/client";
import type { PortalLocation, PaymentMethodView, CustomerAddressView } from "@/lib/portal/server";
import type { DeliveryPolicyData } from "@/lib/orders/server";
import { money } from "@/lib/pos/money";
import { isScheduleOpenNow } from "@/lib/schedule";
import { swalError, swalLoading, swalClose, swalPrompt, swalConfirm } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { InputGroupField } from "@/components/base/input-group-field";
import { SwipeableRow } from "@/components/shared/swipeable-row";
import { GpsPicker, type GpsValue } from "@/components/base/gps-picker";
import { PermissionSlider } from "@/components/shared/permission-slider";
import { cn } from "@/lib/utils";

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function CheckoutClient() {
  const router = useRouter();
  const items = usePortalStore((s) => s.items);
  const clearCart = usePortalStore((s) => s.clearCart);
  const removeItem = usePortalStore((s) => s.removeItem);

  const [locations, setLocations] = useState<PortalLocation[]>([]);
  const [methods, setMethods] = useState<PaymentMethodView[]>([]);
  const [policy, setPolicy] = useState<DeliveryPolicyData | null>(null);
  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "delivery">("pickup");
  const [locationId, setLocationId] = useState<string>("");
  const [address, setAddress] = useState("");
  const [gps, setGps] = useState<GpsValue | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddressView[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "online">("cash");
  const [cardId, setCardId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [loyalty, setLoyalty] = useState<LoyaltyData | null>(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [geoPermissionOpen, setGeoPermissionOpen] = useState(false);
  const [promotions, setPromotions] = useState<PortalPromotionPreview[]>([]);

  const subtotal = cartSubtotal(items);
  const tax = cartTax(items);

  // Evaluar promociones en tiempo real sobre los items del carrito
  const promoPreview = useMemo(() => {
    if (!promotions.length) return { discount: 0, label: "" };
    return evaluatePortalPromotions(promotions, items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      productType: i.kind,
      productName: i.name,
      variantName: i.variantName,
      quantity: i.qty,
      unitId: i.unitId,
      unitPrice: i.unitPrice,
      lineTotal: i.unitPrice * i.qty,
      categoryId: i.categoryId,
    })));
  }, [promotions, items]);

  const deliveryFee = useMemo(() => {
    if (!policy) return 0;
    if (deliveryMethod === "pickup") {
      if (!policy.pickupFeeEnabled) return 0;
      return policy.pickupFee;
    }
    if (!policy.deliveryFeeEnabled) return 0;
    return policy.deliveryFee;
  }, [policy, deliveryMethod]);

  const total = subtotal + tax + deliveryFee - promoPreview.discount;

  const pointsValue = loyalty ? Math.min(pointsToRedeem * loyalty.pointValue, total) : 0;
  const payableTotal = Math.max(0, total - pointsValue);
  const maxPoints = loyalty
    ? Math.min(Math.floor(loyalty.points), Math.floor(total / loyalty.pointValue))
    : 0;

  const applyPoints = (pts: number) => {
    setPointsToRedeem(Math.max(0, Math.min(Math.floor(pts), maxPoints)));
  };

  const scheduleInfo = useMemo(() => {
    if (!policy) return null;
    const schedule = deliveryMethod === "pickup" ? policy.pickupSchedule : policy.deliverySchedule;
    return isScheduleOpenNow(schedule);
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
    Promise.all([portalApi.locations(), portalApi.paymentMethods(), portalApi.deliveryPolicy(), portalApi.addresses(), portalApi.loyalty(), portalApi.promotions()])
      .then(([l, m, p, a, ly, pr]) => {
        if (!active) return;
        setLocations(l.locations);
        setMethods(m.methods);
        setPolicy(p.policy);
        setOnlinePaymentEnabled(p.onlinePaymentEnabled);
        setAddresses(a.addresses);
        setLoyalty(ly);
        setPromotions(pr.promotions);
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

  const coords = useMemo(() => (gps ? { lat: gps.lat, lng: gps.lon } : null), [gps]);

  function composeAddress(g: GpsValue): string {
    const parts = [
      [g.calle, g.numero].filter(Boolean).join(" "),
      g.colonia,
      g.municipio,
      g.estado,
      g.cp,
    ].filter(Boolean) as string[];
    return parts.join(", ");
  }

  const handleGpsChange = (g: GpsValue | null) => {
    setGps(g);
    setSelectedAddressId(null);
    setAddress(g ? composeAddress(g) : "");
  };

  const selectSavedAddress = (a: CustomerAddressView) => {
    setSelectedAddressId(a.id);
    setAddress(a.address);
    if (a.latitude != null && a.longitude != null) {
      setGps({ lat: a.latitude, lon: a.longitude });
    }
  };

  const saveCurrentAddress = async () => {
    if (!address.trim()) {
      swalError("Primero captura o escribe una dirección");
      return;
    }
    const label = await swalPrompt("Guardar destino", "Nombre del destino (ej. Casa de mis padres)…");
    if (!label) return;
    try {
      const res = await portalApi.addAddress({
        label,
        address: address.trim(),
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
      });
      setAddresses((prev) => [...prev, res.address]);
      setSelectedAddressId(res.address.id);
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    }
  };

  const removeSavedAddress = async (id: string) => {
    const ok = await swalConfirm("Eliminar destino", "¿Seguro que quieres eliminar este destino?");
    if (!ok) return;
    try {
      await portalApi.removeAddress(id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      if (selectedAddressId === id) setSelectedAddressId(null);
    } catch {
      // silent
    }
  };

  // Validación de radio de entrega (distancia a la sucursal más cercana).
  const radiusError = useMemo(() => {
    if (deliveryMethod !== "delivery" || !policy?.deliveryRadiusKm || !coords) return null;
    const nearest = locations
      .filter((l) => l.latitude != null && l.longitude != null)
      .sort((a, b) => {
        const da = distanceKm(coords.lat, coords.lng, a.latitude!, a.longitude!);
        const db = distanceKm(coords.lat, coords.lng, b.latitude!, b.longitude!);
        return da - db;
      })[0];
    if (!nearest) return null;
    const dist = distanceKm(coords.lat, coords.lng, nearest.latitude!, nearest.longitude!);
    return dist > policy.deliveryRadiusKm
      ? `Fuera del radio de entrega (${policy.deliveryRadiusKm} km)`
      : null;
  }, [deliveryMethod, policy, coords, locations]);

  const submit = async () => {
    if (deliveryMethod === "pickup" && !locationId) {
      swalError("Selecciona una sucursal");
      return;
    }
    if (deliveryMethod === "delivery" && !address.trim()) {
      swalError("Ingresa una dirección de entrega");
      return;
    }
    if (deliveryMethod === "delivery" && radiusError) {
      swalError(radiusError);
      return;
    }
    if (scheduleInfo && !scheduleInfo.open) {
      swalError(scheduleInfo.message);
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
          categoryId: i.categoryId,
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
        pointsRedeemed: pointsToRedeem,
        subtotal,
        discount: 0,
        deliveryFee,
        total: payableTotal,
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
                  className="space-y-3 overflow-hidden pt-1"
                >
                  {/* Destinos guardados */}
                  {addresses.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Destinos guardados</p>
                      <div className="flex flex-wrap gap-1.5">
                        {addresses.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => selectSavedAddress(a)}
                            className={cn(
                              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                              selectedAddressId === a.id
                                ? "border-primary bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted"
                            )}
                          >
                            <Home className="size-3" />
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mapa / ubicación */}
                  <GpsPicker value={gps} onChange={handleGpsChange} onPermissionError={() => setGeoPermissionOpen(true)} />

                  {/* Dirección manual */}
                  <InputGroupField
                    placeholder="Calle, número, colonia, ciudad…"
                    leftIcon={<MapPin className="size-4" />}
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setSelectedAddressId(null);
                    }}
                  />

                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" className="flex-1" onClick={saveCurrentAddress}>
                      <Plus className="size-4" /> Guardar destino
                    </Button>
                    {selectedAddressId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => removeSavedAddress(selectedAddressId)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>

                  {policy?.deliveryEstimatedMins != null && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="size-3.5" /> Entrega estimada: {policy.deliveryEstimatedMins} min
                    </p>
                  )}
                  {radiusError && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                      <AlertTriangle className="size-3.5" /> {radiusError}
                    </p>
                  )}
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
                <span className="flex-1 text-sm font-medium">
                  {deliveryMethod === "delivery" ? "Pagar al repartidor" : "Pagar en sucursal"}
                </span>
              </Label>

              <Label
                htmlFor="pay-online"
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-all",
                  !onlinePaymentEnabled && "cursor-not-allowed opacity-50",
                  payMethod === "online" ? "border-primary bg-primary/5" : "border-transparent bg-muted/50"
                )}
              >
                <RadioGroupItem value="online" id="pay-online" disabled={!onlinePaymentEnabled} />
                <Globe className="size-5 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium">
                  Pagar en línea
                  {!onlinePaymentEnabled && (
                    <span className="block text-xs text-muted-foreground">No disponible — la sucursal no acepta pago en línea</span>
                  )}
                </span>
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

          {/* Puntos */}
          {loyalty && loyalty.loyaltyEnabled && loyalty.points > 0 && (
            <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-amber-500" /> Tus puntos
              </h2>
              <div className="flex items-center gap-2">
                <InputGroupField
                  inputMode="numeric"
                  placeholder={`${Math.floor(loyalty.points)} pts disponibles`}
                  value={pointsToRedeem > 0 ? String(pointsToRedeem) : ""}
                  onChange={(e) => applyPoints(Number(e.target.value.replace(/\D/g, "")))}
                  leftIcon={<Sparkles className="size-4" />}
                />
                <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => applyPoints(maxPoints)} disabled={maxPoints <= 0}>
                  Máximo
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Tienes {Math.floor(loyalty.points)} pts = {money(loyalty.points * loyalty.pointValue)}.
                {pointsToRedeem > 0 && (
                  <span className="text-amber-600"> Canjeando {pointsToRedeem} pts = -{money(pointsValue)}</span>
                )}
              </p>
            </section>
          )}

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
              {promoPreview.discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span className="flex items-center gap-1">
                    <Sparkles className="size-3.5" /> {promoPreview.label || "Promoción"}
                  </span>
                  <span>-{money(promoPreview.discount)}</span>
                </div>
              )}
              {deliveryFee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {deliveryMethod === "delivery" ? <Truck className="size-3.5" /> : <Store className="size-3.5" />}
                    {deliveryMethod === "delivery" ? "Envío" : "Cargo por recoger"}
                  </span>
                  <span>{money(deliveryFee)}</span>
                </div>
              )}
              {pointsToRedeem > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span className="flex items-center gap-1">
                    <Sparkles className="size-3.5" /> Puntos ({pointsToRedeem} pts)
                  </span>
                  <span>-{money(pointsValue)}</span>
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
                <span>{money(payableTotal)}</span>
              </div>
            </div>
          </section>

          <div className="space-y-2">
            <Label>Notas para tu pedido (opcional)</Label>
            <Textarea
              placeholder="Notas para tu pedido (opcional)…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-2xl"
            />
          </div>

          {/* Submit — fixed at bottom on mobile */}
          <div className="sticky bottom-0 -mx-4 bg-background px-4 pt-3 pb-4">
            <Button
              className="h-14 w-full rounded-2xl text-base font-bold shadow-lg"
              onClick={submit}
              disabled={submitting || !!minAmountError || !!radiusError || (scheduleInfo != null && !scheduleInfo.open)}
            >
              <CircleCheck className="mr-2 size-5" />
              {submitting ? "Procesando…" : `Confirmar pedido · ${money(payableTotal)}`}
            </Button>
          </div>
        </>
      )}

      <PermissionSlider
        type="geolocation"
        open={geoPermissionOpen}
        onOpenChange={setGeoPermissionOpen}
        onGranted={() => setGeoPermissionOpen(false)}
        onDenied={() => setGeoPermissionOpen(false)}
      />
    </div>
  );
}
