"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Banknote, CreditCard, Globe, MapPin, Store, Truck, Clock, AlertTriangle, ShoppingBag, Home, Plus, Trash2, Sparkles, Navigation } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePortalStore, cartSubtotal, cartTax } from "@/stores/portal-store";
import { portalApi, type LoyaltyData, type PortalPromotionPreview } from "@/lib/portal/client";
import { evaluatePortalPromotions } from "@/lib/portal/promo-engine";
import { paymentsApi } from "@/lib/payments/client";
import type { PortalLocation, PaymentMethodView, CustomerAddressView, PortalOrderInput } from "@/lib/portal/server";
import type { DeliveryPolicyData } from "@/lib/orders/server";
import { money } from "@/lib/pos/money";
import { isScheduleOpenNow } from "@/lib/schedule";
import { swalError, swalPrompt, swalConfirm } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { InputGroupField } from "@/components/base/input-group-field";
import { SwipeableRow } from "@/components/shared/swipeable-row";
import { GpsPicker, type GpsValue } from "@/components/base/gps-picker";
import { PermissionSlider } from "@/components/shared/permission-slider";
import { SlideToPay } from "@/components/shared/slide-to-pay";
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ location?: string; address?: string }>({});

  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "delivery">("pickup");
  const [locationId, setLocationId] = useState<string>("");
  const [address, setAddress] = useState("");
  const [gps, setGps] = useState<GpsValue | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddressView[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "online" | "credit">("cash");
  const [credit, setCredit] = useState<{ creditLimit: number | null; currentBalance: number; allowed: boolean; reason?: string } | null>(null);
  const [cardId, setCardId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [loyalty, setLoyalty] = useState<LoyaltyData | null>(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [geoPermissionOpen, setGeoPermissionOpen] = useState(false);
  const [promotions, setPromotions] = useState<PortalPromotionPreview[]>([]);
  const [tipMode, setTipMode] = useState<"none" | "percent" | "custom">("none");
  const [tipPercent, setTipPercent] = useState(15);
  const [tipCustom, setTipCustom] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID().replace(/-/g, ""));

  const subtotal = cartSubtotal(items);
  const tax = cartTax(items);
  const coords = useMemo(() => (gps ? { lat: gps.lat, lng: gps.lon } : null), [gps]);
  const nearestDeliveryBranch = useMemo(() => {
    if (deliveryMethod !== "delivery" || !coords) return null;
    return locations
      .filter((location) => location.allowsDelivery && location.latitude != null && location.longitude != null)
      .map((location) => ({
        ...location,
        dist: distanceKm(coords.lat, coords.lng, location.latitude!, location.longitude!),
      }))
      .sort((a, b) => a.dist - b.dist)[0] ?? null;
  }, [deliveryMethod, coords, locations]);

  const checkoutItems = useMemo<PortalOrderInput["items"]>(() => items.flatMap((item): PortalOrderInput["items"] => {
    if (item.comboId && item.comboItems) {
      return item.comboItems.map((comboItem) => ({
        productId: comboItem.productId,
        variantId: comboItem.variantId,
        productType: comboItem.productType,
        productName: comboItem.productName,
        variantName: comboItem.variantName,
        quantity: comboItem.quantity * item.qty,
        unitId: null,
        unitPrice: comboItem.unitPrice,
        lineTotal: comboItem.unitPrice * comboItem.quantity * item.qty,
        categoryId: comboItem.categoryId,
        extraPrice: comboItem.extraPrice,
        comboId: item.comboId,
        comboItemId: comboItem.id,
        comboQuantity: item.qty,
        comment: `Combo: ${item.name}`,
      }));
    }
    return [{
      productId: item.productId,
      variantId: item.variantId,
      productType: item.kind,
      productName: item.name,
      variantName: item.variantName,
      quantity: item.qty,
      unitId: item.unitId,
      unitPrice: item.unitPrice,
      lineTotal: item.unitPrice * item.qty,
      categoryId: item.categoryId,
      bulkQuantityDisplay: item.bulkQuantityDisplay ?? null,
      comment: item.comment ?? null,
      selectedOptions: item.selectedOptions,
      extraPrice: item.extraPrice ?? 0,
    }];
  }), [items]);

  // Evaluar promociones en tiempo real sobre los items del carrito
  const promoPreview = useMemo(() => {
    if (!promotions.length) return { discount: 0, label: "" };
    return evaluatePortalPromotions(promotions, checkoutItems);
  }, [promotions, checkoutItems]);

  const deliveryFee = useMemo(() => {
    if (!policy) return 0;
    if (deliveryMethod === "pickup") {
      if (!policy.pickupFeeEnabled) return 0;
      return policy.pickupFee;
    }
    if (!policy.deliveryFeeEnabled) return 0;
    if (policy.deliveryFeeType === "per_km") {
      return Math.round((nearestDeliveryBranch?.dist ?? 0) * policy.deliveryFeePerKm * 100) / 100;
    }
    return policy.deliveryFee;
  }, [policy, deliveryMethod, nearestDeliveryBranch]);

  const tipAmount = tipMode === "percent" ? Math.round(subtotal * (tipPercent / 100) * 100) / 100 : tipMode === "custom" ? parseFloat(tipCustom.replace(",", ".")) || 0 : 0;
  const total = Math.max(0, subtotal + tax + deliveryFee - promoPreview.discount + tipAmount);

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
    if (!schedule?.length) return null;
    return isScheduleOpenNow(schedule);
  }, [policy, deliveryMethod]);

  const minAmount = useMemo(() => {
    if (!policy) return null;
    return deliveryMethod === "pickup" ? policy.pickupMinAmount : policy.deliveryMinAmount;
  }, [policy, deliveryMethod]);

  const minAmountError = useMemo(() => {
    if (!minAmount || subtotal >= minAmount) return null;
    return `Monto mínimo: ${money(minAmount)}`;
  }, [minAmount, subtotal]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    Promise.all([portalApi.locations(), portalApi.paymentMethods(), portalApi.deliveryPolicy(), portalApi.addresses(), portalApi.loyalty(), portalApi.promotions(), portalApi.credit()])
      .then(([l, m, p, a, ly, pr, cr]) => {
        if (!active) return;
        setLocations(l.locations);
        setMethods(m.methods);
        setPolicy(p.policy);
        setOnlinePaymentEnabled(p.onlinePaymentEnabled);
        setAddresses(a.addresses);
        setLoyalty(ly);
        setPromotions(pr.promotions);
        setCredit({ creditLimit: cr.credit?.creditLimit ?? null, currentBalance: cr.credit?.currentBalance ?? 0, allowed: cr.canUse.allowed, reason: cr.canUse.reason });
        const pickupLoc = l.locations.find((x) => x.allowsPickup);
        setLocationId(pickupLoc?.id ?? "");
        if (l.locations.every((x) => !x.allowsPickup)) setDeliveryMethod("delivery");
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "No fue posible cargar los datos del pedido");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  useEffect(() => {
    if (loading || loadError) return;
    const firstId = locations.some((location) => location.allowsPickup) && policy?.pickupEnabled !== false
      ? "delivery-method-pickup"
      : "delivery-method-delivery";
    requestAnimationFrame(() => document.getElementById(firstId)?.focus());
  }, [loading, loadError, locations, policy?.pickupEnabled]);

  const pickupLocations = useMemo(() => locations.filter((l) => l.allowsPickup), [locations]);

  // ── Nearest branch computation ──────────────────────────────
  const selectedCard = methods.find((m) => m.id === cardId) ?? methods[0];

  useEffect(() => {
    if (!cardId && methods.length) setCardId(methods[0].id);
  }, [methods, cardId]);

  // ── Nearest branch computation ──────────────────────────────
  const pickupWithDistance = useMemo(() => {
    return pickupLocations
      .map((l) => ({
        ...l,
        distanceKm: l.latitude != null && l.longitude != null && coords
          ? distanceKm(coords.lat, coords.lng, l.latitude, l.longitude)
          : null,
      }))
      .sort((a, b) => {
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
  }, [pickupLocations, coords]);

  const nearestPickup = pickupWithDistance.find((l) => l.distanceKm != null);

  const effectiveBranchId = deliveryMethod === "pickup"
    ? locationId
    : nearestDeliveryBranch?.id ?? locations.find((location) => location.allowsDelivery)?.id ?? "";

  useEffect(() => {
    if (loading || !effectiveBranchId) return;
    let active = true;
    setPolicyLoading(true);
    portalApi.deliveryPolicy(effectiveBranchId)
      .then((result) => {
        if (!active) return;
        setPolicy(result.policy);
        setOnlinePaymentEnabled(result.onlinePaymentEnabled);
      })
      .catch((error) => {
        if (active) setSubmitError(error instanceof Error ? error.message : "No se pudo actualizar la política de entrega");
      })
      .finally(() => {
        if (active) setPolicyLoading(false);
      });
    return () => {
      active = false;
    };
  }, [effectiveBranchId, loading]);

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
    if (g) setFieldErrors((current) => ({ ...current, address: undefined }));
  };

  const selectSavedAddress = (a: CustomerAddressView) => {
    setSelectedAddressId(a.id);
    setAddress(a.address);
    setFieldErrors((current) => ({ ...current, address: undefined }));
    if (a.latitude != null && a.longitude != null) {
      setGps({ lat: a.latitude, lon: a.longitude });
    }
  };

  const saveCurrentAddress = async () => {
    if (!address.trim()) {
      setFieldErrors((current) => ({ ...current, address: "Primero captura o escribe una dirección" }));
      requestAnimationFrame(() => document.getElementById("delivery-address")?.focus());
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
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No se pudo eliminar el destino");
    }
  };

  // Auto-select closest pickup branch when GPS changes
  useEffect(() => {
    if (deliveryMethod !== "pickup" || !coords || pickupWithDistance.length === 0) return;
    const closest = pickupWithDistance[0];
    if (closest && closest.id !== locationId) {
      setLocationId(closest.id);
    }
  }, [coords, deliveryMethod, locationId, pickupWithDistance]);

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
    setSubmitError(null);
    const nextErrors: { location?: string; address?: string } = {};
    if (deliveryMethod === "pickup" && !locationId) {
      nextErrors.location = "Selecciona una sucursal";
    }
    if (deliveryMethod === "delivery" && !address.trim()) {
      nextErrors.address = "Ingresa una dirección de entrega";
    }
    setFieldErrors(nextErrors);
    if (nextErrors.location || nextErrors.address) {
      const targetId = nextErrors.location
        ? (pickupWithDistance[0] ? `loc-${pickupWithDistance[0].id}` : "delivery-method-pickup")
        : "delivery-address";
      requestAnimationFrame(() => document.getElementById(targetId)?.focus());
      return false;
    }
    if (deliveryMethod === "delivery" && radiusError) {
      setSubmitError(radiusError);
      return false;
    }
    if (scheduleInfo && !scheduleInfo.open) {
      setSubmitError(scheduleInfo.message);
      return false;
    }

    setSubmitting(true);
    try {
      const order = await portalApi.createOrder({
        idempotencyKey,
        items: checkoutItems,
        deliveryMethod,
        locationId: effectiveBranchId || null,
        address: deliveryMethod === "delivery" ? address : null,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        paymentMethod: payMethod === "cash" ? "cash" : payMethod === "credit" ? "credit" : "card",
        paymentReference:
          payMethod === "card" ? selectedCard?.last4 ?? null : payMethod === "online" ? "gateway" : null,
        pointsRedeemed: pointsToRedeem,
        subtotal,
        discount: promoPreview.discount,
        deliveryFee,
        tip: tipAmount > 0 ? tipAmount : undefined,
        total: payableTotal,
        notes: notes.trim() || null,
      });

      if (payMethod === "online") {
        const pay = await paymentsApi.payOrder(order.order.id);
        clearCart();
        window.location.assign(pay.url);
        return true;
      }

      clearCart();
      router.push(`/portal/orders/${order.order.id}`);
      return true;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "No se pudo crear el pedido");
      return false;
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
          id="checkout-back"
          type="button"
          aria-label="Volver al carrito"
          onClick={() => router.back()}
          className="flex size-11 items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted/80 active:scale-95"
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
      ) : loadError ? (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-center">
          <AlertTriangle className="mx-auto size-7 text-destructive" />
          <p className="mt-3 font-semibold">No pudimos preparar el checkout</p>
          <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
          <Button className="mt-4 min-h-11" variant="outline" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
            Volver a intentar
          </Button>
        </div>
      ) : (
        <>
          {/* Entrega */}
          <section className="space-y-3 rounded-2xl border bg-card p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="size-4 text-primary" /> ¿Cómo lo quieres recibir?
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="delivery-method-pickup"
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
                  <span className="text-xs text-muted-foreground">{money(policy.pickupFee)}</span>
                )}
              </button>
              <button
                id="delivery-method-delivery"
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
                {policy?.deliveryFeeEnabled && (policy.deliveryFeeType === "per_km" ? policy.deliveryFeePerKm > 0 : policy.deliveryFee > 0) && (
                  <span className="text-xs text-muted-foreground">{policy.deliveryFeeType === "per_km" ? `${money(policy.deliveryFeePerKm)}/km` : money(policy.deliveryFee)}</span>
                )}
              </button>
            </div>

            {deliveryMethod === "delivery" && policy?.deliveryFeeEnabled && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
                {policy.deliveryFeeType === "per_km" ? (
                  <p><strong>Envío por distancia:</strong> {nearestDeliveryBranch?.dist.toFixed(1) ?? "0.0"} km × {money(policy.deliveryFeePerKm)} = <strong>{money(deliveryFee)}</strong>. Se usa la sucursal habilitada más cercana.</p>
                ) : (
                  <p><strong>Tarifa fija:</strong> pagarás {money(policy.deliveryFee)} por el envío, sin importar la distancia dentro del radio permitido.</p>
                )}
              </div>
            )}

            <AnimatePresence mode="wait">
              {deliveryMethod === "pickup" && (
                <motion.div
                  key="pickup"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <RadioGroup
                    value={locationId}
                    onValueChange={(value) => {
                      setLocationId(value);
                      setFieldErrors((current) => ({ ...current, location: undefined }));
                    }}
                    aria-invalid={Boolean(fieldErrors.location) || undefined}
                    aria-describedby={fieldErrors.location ? "pickup-location-error" : undefined}
                    className="space-y-2 pt-1"
                  >
                    {pickupWithDistance.map((l) => {
                      const isNearest = nearestPickup?.id === l.id && l.distanceKm != null;
                      return (
                        <Label
                          key={l.id}
                          htmlFor={`loc-${l.id}`}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-all",
                            locationId === l.id
                              ? "border-primary bg-primary/5 shadow-sm"
                              : isNearest
                                ? "border-success/30 bg-success/10"
                                : "border-transparent bg-muted/50"
                          )}
                        >
                          <RadioGroupItem value={l.id} id={`loc-${l.id}`} className="mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{l.name}</span>
                              {isNearest && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-1 text-xs font-semibold text-success-ink">
                                  <Navigation className="size-2.5" />
                                  Más cercana
                                </span>
                              )}
                              {l.distanceKm != null && (
                                <span className="text-xs tabular-nums text-muted-foreground">
                                  {l.distanceKm < 1
                                    ? `${Math.round(l.distanceKm * 1000)} m`
                                    : `${l.distanceKm.toFixed(1)} km`}
                                </span>
                              )}
                            </div>
                            {l.address && <span className="block text-xs text-muted-foreground">{l.address}</span>}
                            {l.openingHours && <span className="block text-xs text-muted-foreground">{l.openingHours}</span>}
                          </div>
                        </Label>
                      );
                    })}
                  </RadioGroup>
                  {fieldErrors.location && (
                    <p id="pickup-location-error" role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                      <AlertTriangle className="size-3.5" /> {fieldErrors.location}
                    </p>
                  )}
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
                              "flex min-h-11 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
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
                    id="delivery-address"
                    label="Dirección de entrega"
                    required
                    placeholder="Calle, número, colonia, ciudad…"
                    leftIcon={<MapPin className="size-4" />}
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setSelectedAddressId(null);
                      if (e.target.value.trim()) setFieldErrors((current) => ({ ...current, address: undefined }));
                    }}
                    error={fieldErrors.address}
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
                        className="min-h-11 min-w-11 text-destructive"
                        aria-label="Eliminar destino seleccionado"
                        onClick={() => removeSavedAddress(selectedAddressId)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>

                  {nearestDeliveryBranch && (
                    <div className="flex items-center gap-2 rounded-xl bg-primary/5 px-3 py-2">
                      <Store className="size-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">Se surtirá desde: {nearestDeliveryBranch.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {nearestDeliveryBranch.dist < 1
                            ? `${Math.round(nearestDeliveryBranch.dist * 1000)} m de distancia`
                            : `${nearestDeliveryBranch.dist.toFixed(1)} km de distancia`}
                          {nearestDeliveryBranch.address && ` · ${nearestDeliveryBranch.address}`}
                        </p>
                      </div>
                    </div>
                  )}
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
          <section className="space-y-3 rounded-2xl border bg-card p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CreditCard className="size-4 text-primary" /> Método de pago
            </h2>
            <RadioGroup
              value={payMethod}
              onValueChange={(v) => setPayMethod(v as "cash" | "card" | "online" | "credit")}
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
                htmlFor="pay-credit"
                className={cn("flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-all", (!credit?.allowed || (credit.creditLimit != null && payableTotal > credit.creditLimit - credit.currentBalance)) && "cursor-not-allowed opacity-60", payMethod === "credit" ? "border-primary bg-primary/5" : "border-transparent bg-muted/50")}
              >
                <RadioGroupItem value="credit" id="pay-credit" disabled={!credit?.allowed || payableTotal <= 0 || (credit.creditLimit != null && payableTotal > credit.creditLimit - credit.currentBalance)} />
                <CreditCard className="size-5 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium">Comprar a crédito
                  <span className="block text-xs text-muted-foreground">{credit?.allowed ? credit.creditLimit != null ? `Disponible: ${money(Math.max(0, credit.creditLimit - credit.currentBalance))}` : "Disponible según las condiciones de la empresa" : credit?.reason ?? "Consultando disponibilidad…"}</span>
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
            <section className="space-y-3 rounded-2xl border bg-card p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-warning-ink" /> Tus puntos
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
                  <span className="text-warning-ink"> Canjeando {pointsToRedeem} pts = -{money(pointsValue)}</span>
                )}
              </p>
            </section>
          )}

          {/* Propina */}
          <section className="space-y-3 rounded-2xl border bg-card p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              💰 Propina (opcional)
            </h2>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              <button
                type="button"
                onClick={() => setTipMode("none")}
                className={cn(
                  "min-h-11 rounded-xl border px-2 py-2.5 text-xs font-semibold transition",
                  tipMode === "none"
                    ? "border-success bg-success/10 text-success-ink"
                    : "border-muted-foreground/20 text-muted-foreground hover:border-success/50"
                )}
              >
                Sin propina
              </button>
              {[10, 15, 20, 25].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    setTipMode("percent")
                    setTipPercent(pct)
                  }}
                  className={cn(
                    "min-h-11 rounded-xl border px-2 py-2.5 text-xs font-semibold transition",
                    tipMode === "percent" && tipPercent === pct
                      ? "border-success bg-success/10 text-success-ink"
                      : "border-muted-foreground/20 text-muted-foreground hover:border-success/50"
                  )}
                >
                  {pct}%
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 flex-1"
                onClick={() => setTipMode(tipMode === "custom" ? "none" : "custom")}
              >
                {tipMode === "custom" ? "Cancelar" : "Otro monto"}
              </Button>
              {tipMode === "custom" && (
                <Input
                  value={tipCustom}
                  onChange={(e) => setTipCustom(e.target.value.replace(/[^\d.,]/g, ""))}
                  placeholder="$0.00"
                  inputMode="decimal"
                  className="h-9 w-24"
                />
              )}
            </div>
            {tipAmount > 0 && (
              <p className="text-xs text-success-ink">
                Propina: {money(tipAmount)}
              </p>
            )}
          </section>

          {/* Resumen */}
          <section className="rounded-2xl border bg-card p-4">
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
                <div className="flex justify-between text-success-ink">
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
                <div className="flex justify-between text-warning-ink">
                  <span className="flex items-center gap-1">
                    <Sparkles className="size-3.5" /> Puntos ({pointsToRedeem} pts)
                  </span>
                  <span>-{money(pointsValue)}</span>
                </div>
              )}
              {tipAmount > 0 && (
                <div className="flex justify-between text-success-ink">
                  <span>💰 Propina</span>
                  <span>+{money(tipAmount)}</span>
                </div>
              )}
              {scheduleInfo && (
                <div className={cn("flex items-center gap-1.5 text-xs", scheduleInfo.open ? "text-success-ink" : "text-warning-ink")}>
                  <Clock className="size-3" />
                  {scheduleInfo.message}
                </div>
              )}
              {minAmountError && (
                <div className="flex items-center gap-1.5 text-xs text-warning-ink">
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
            <Label htmlFor="checkout-notes">Notas para tu pedido (opcional)</Label>
            <Textarea
              id="checkout-notes"
              placeholder="Notas para tu pedido (opcional)…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-2xl"
            />
          </div>

          {/* La acción permanece encima de la navegación fija del portal. */}
          <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 -mx-4 border-t bg-background/95 px-4 pb-3 pt-3 backdrop-blur">
            <p className="mb-2 text-center text-xs leading-5 text-muted-foreground">Al confirmar aceptas las <Link href="/legal/comercio" target="_blank" className="underline underline-offset-4">condiciones de compra</Link> y el <Link href="/legal/privacidad" target="_blank" className="underline underline-offset-4">aviso de privacidad</Link>.</p>
            {submitError && (
              <p role="alert" className="mb-2 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {submitError}
              </p>
            )}
            <SlideToPay
              action="payment"
              label={`${payMethod === "online" || payMethod === "card" ? "Desliza para pagar" : "Desliza para confirmar"} · ${money(payableTotal)}`}
              hint="Revisa el total y desliza para continuar"
              onConfirm={submit}
              loading={submitting}
              disabled={policyLoading || !!minAmountError || !!radiusError || (scheduleInfo != null && !scheduleInfo.open)}
            />
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
