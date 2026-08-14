"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CreditCard, Globe, LocateFixed, MapPin, Store } from "lucide-react";
import { usePortalStore, cartSubtotal, cartTax, cartTotal } from "@/stores/portal-store";
import { portalApi } from "@/lib/portal/client";
import { paymentsApi } from "@/lib/payments/client";
import type { PortalLocation, PaymentMethodView } from "@/lib/portal/server";
import { money } from "@/lib/pos/money";
import { swalError, swalLoading, swalClose } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function CheckoutClient() {
  const router = useRouter();
  const items = usePortalStore((s) => s.items);
  const clearCart = usePortalStore((s) => s.clearCart);

  const [locations, setLocations] = useState<PortalLocation[]>([]);
  const [methods, setMethods] = useState<PaymentMethodView[]>([]);
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
  const total = cartTotal(items);

  useEffect(() => {
    let active = true;
    Promise.all([portalApi.locations(), portalApi.paymentMethods()])
      .then(([l, m]) => {
        if (!active) return;
        setLocations(l.locations);
        setMethods(m.methods);
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
                disabled={pickupLocations.length === 0}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-3 text-sm font-medium transition-colors disabled:opacity-40",
                  deliveryMethod === "pickup" ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Store className="size-5" /> Recoger en sucursal
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMethod("delivery")}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-3 text-sm font-medium transition-colors",
                  deliveryMethod === "delivery" ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <MapPin className="size-5" /> A domicilio
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
                <Input
                  placeholder="Calle, número, colonia, ciudad…"
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
                      Tarjeta {selectedCard?.brand ?? ""} •••• {selectedCard?.last4}
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
