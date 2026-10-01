"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowRight,
  Bike,
  CircleCheckBig,
  ClipboardCheck,
  Clock,
  Home,
  Lightbulb,
  Loader2,
  MapPin,
  MessageCircle,
  PackageCheck,
  PackageOpen,
  Phone,
  ReceiptText,
  Store,
  Truck,
  Wallet,
  X,
  type LucideIcon,
  Printer,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/base/status-pill";
import { money } from "@/lib/pos/money";
import { swalConfirm, swalError, swalToast } from "@/lib/swal";
import { ORDER_STATUS_LABELS, ordersApi, type OrderDetail, type OrderStatusKey } from "@/lib/orders/client";
import { cn } from "@/lib/utils";
import { DeliveryConfirmDialog } from "./delivery-confirm-dialog";
import { OrderPaymentDialog } from "./order-payment-dialog";
import { OrderStatusPill } from "@/components/shared/order-status-pill";

// Detalle del pedido, pensado para guiar: muestra el recorrido con la hora de
// cada paso, explica qué sigue y ofrece solo la acción que corresponde.

const time = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
const shortDate = (iso: string) => new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const PAY_LABELS: Record<string, string> = { cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia", wallet: "Monedero", credit: "Crédito", mercadopago: "Mercado Pago", stripe: "Tarjeta en línea" };

const STEP_ICON: Record<string, LucideIcon> = {
  pending: Clock,
  confirmed: ClipboardCheck,
  preparing: PackageOpen,
  ready: PackageCheck,
  in_transit: Truck,
  at_destination: MapPin,
  delivered: Home,
};

const DELIVERY_FLOW: OrderStatusKey[] = ["pending", "confirmed", "preparing", "ready", "in_transit", "at_destination", "delivered"];
const PICKUP_FLOW: OrderStatusKey[] = ["pending", "confirmed", "preparing", "ready", "delivered"];

/** Qué sigue, explicado en lenguaje de operación. */
function guidance(o: OrderDetail): string {
  const delivery = o.deliveryMethod === "delivery";
  switch (o.status) {
    case "pending":
      return "El cliente espera tu confirmación. Al confirmarlo avisamos al cliente y el pedido pasa a preparación.";
    case "confirmed":
      return "Ya está confirmado. Abre la preparación y marca cada producto conforme lo juntas.";
    case "preparing":
      return "Se está preparando. Termina de marcar los productos para dejarlo listo.";
    case "ready":
      return delivery
        ? "Está listo. Entrégalo al repartidor y márcalo «en camino»: el cliente verá el seguimiento."
        : `Listo para recoger. Cuando llegue el cliente${o.isPaid ? "" : ", cóbralo"} y valida su PIN o QR.`;
    case "in_transit":
      return "Va en camino. Cuando el repartidor llegue al domicilio, confirma la llegada: se genera el PIN del cliente.";
    case "at_destination":
      return `El repartidor está en el domicilio.${o.isPaid ? "" : " Cobra el pedido y"} valida el PIN o QR que muestra el cliente.`;
    case "delivered":
      return o.saleId
        ? `Entregado. Quedó registrado como venta PED-${o.orderNumber}: descontó inventario y entró al corte de caja.`
        : o.isTableOrder
          ? "Entregado en mesa: se cobra desde el POS con la cuenta de la mesa."
          : "Entregado, pero aún no tiene su venta registrada. Regístrala para que cuadre inventario y caja.";
    case "cancelled":
      return "Pedido cancelado. No se movió inventario ni caja.";
    default:
      return "";
  }
}

function nextAction(o: OrderDetail): { label: string; icon: LucideIcon; kind: "advance" | "prepare" | "pin" } | null {
  const delivery = o.deliveryMethod === "delivery";
  if (o.status === "pending") return { label: "Confirmar pedido", icon: CircleCheckBig, kind: "advance" };
  if (o.status === "confirmed") return { label: "Empezar preparación", icon: PackageOpen, kind: "prepare" };
  if (o.status === "preparing") return { label: "Continuar preparación", icon: PackageOpen, kind: "prepare" };
  if (o.status === "ready") return delivery ? { label: "Enviar a domicilio", icon: Truck, kind: "advance" } : { label: "Entregar con PIN o QR", icon: CircleCheckBig, kind: "pin" };
  if (o.status === "in_transit") return { label: "Confirmar llegada", icon: MapPin, kind: "advance" };
  if (o.status === "at_destination") return { label: "Entregar con PIN o QR", icon: CircleCheckBig, kind: "pin" };
  return null;
}

export function OrderDetailDialog({ orderId, canManage, onChanged }: { orderId: string; canManage: boolean; onChanged?: () => void }) {
  const [open, setOpen] = useState(true);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const reduce = useReducedMotion();

  const load = async () => {
    try {
      setOrder((await ordersApi.detail(orderId)).order);
    } catch {
      /* se muestra el esqueleto */
    }
  };
  useEffect(() => {
    void load();
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    onChanged?.();
    setOpen(false);
  };

  const run = async (fn: () => Promise<void>, ok: string, closeAfter = true) => {
    setSaving(true);
    try {
      await fn();
      swalToast(ok);
      if (closeAfter) close();
      else await load();
    } catch (err) {
      swalError("No se pudo completar", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const post = async (url: string) => {
    const res = await fetch(url, { method: "POST" });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
  };

  const act = () => {
    if (!order) return;
    const a = nextAction(order);
    if (!a) return;
    if (a.kind === "prepare") {
      onChanged?.();
      window.location.href = `/admin/orders/${order.id}/prepare`;
      return;
    }
    if (a.kind === "pin") {
      if (!order.isPaid) {
        swalError("Falta el cobro", "Cobra el pedido antes de validar la entrega.");
        return;
      }
      setConfirmOpen(true);
      return;
    }
    if (order.status === "pending") return void run(() => post(`/api/orders/${order.id}/confirm`), "Pedido confirmado");
    if (order.status === "in_transit") return void run(() => post(`/api/orders/${order.id}/confirm-arrival`), "Llegada confirmada");
    if (order.status === "ready") return void run(async () => void (await ordersApi.updateStatus(order.id, "in_transit")), "Pedido en camino");
  };

  const cancel = async () => {
    if (!order) return;
    if (!(await swalConfirm("Cancelar pedido", `El pedido #${order.orderNumber} se cancelará y se avisará al cliente.`, { danger: true, confirmText: "Cancelar pedido" }))) return;
    await run(async () => void (await ordersApi.updateStatus(order.id, "cancelled")), "Pedido cancelado");
  };

  const delivery = order?.deliveryMethod === "delivery";
  const flow = delivery ? DELIVERY_FLOW : PICKUP_FLOW;
  const current = order ? flow.indexOf(order.status as OrderStatusKey) : -1;
  const reachedAt = (status: string) => order?.history.find((h) => h.status === status)?.createdAt ?? null;
  const action = order ? nextAction(order) : null;
  const taxes = order ? Math.max(0, Math.round((order.total + order.pointsValue - order.subtotal + order.discount - order.deliveryFee - order.tip) * 100) / 100) : 0;
  const needsCharge =
    !!order && canManage && !order.isPaid && !order.isTableOrder && ((delivery && order.status === "at_destination") || (!delivery && order.status === "ready"));
  const needsSale = !!order && !order.saleId && !order.isTableOrder && order.status === "delivered";
  const phoneDigits = order?.customerPhone?.replace(/\D/g, "") ?? "";

  return (
    <>
      <DialogComponent
        open={open}
        onOpenChange={(v) => (v ? setOpen(true) : close())}
        size="3xl"
        icon={<ReceiptText className="size-5" />}
        title={order ? `Pedido #${order.orderNumber}` : "Pedido"}
        description={order ? `${shortDate(order.createdAt)} · hace ${formatDistanceToNow(new Date(order.createdAt), { locale: es })}` : undefined}
        bodyClassName="space-y-4"
        footer={
          order && canManage && order.status !== "cancelled" && order.status !== "delivered" ? (
            <>
              {(order.status === "pending" || order.status === "confirmed") && (
                <Button variant="ghost" className="mr-auto text-destructive" onClick={() => void cancel()} disabled={saving}>
                  <X className="size-4" /> Cancelar pedido
                </Button>
              )}
              {needsCharge && (
                <Button variant="outline" onClick={() => setPayOpen(true)}>
                  <Wallet className="size-4" /> Cobrar {money(order.total)}
                </Button>
              )}
              {action && (
                <Button onClick={act} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <action.icon className="size-4" />}
                  {action.label}
                  <ArrowRight className="size-4" />
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {!order ? (
          <div className="space-y-3 py-4">
            <div className="h-24 animate-pulse rounded-2xl bg-muted" />
            <div className="h-40 animate-pulse rounded-2xl bg-muted" />
          </div>
        ) : (
          <>
            {/* Recorrido */}
            <section className="rounded-2xl border bg-card p-4">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <OrderStatusPill status={order.status} />
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                  {delivery ? <Bike className="size-3.5" /> : <Store className="size-3.5" />}
                  {delivery ? "A domicilio" : "Recoger en sucursal"}
                </span>
                {order.isPaid ? <StatusPill tone="success">Pagado</StatusPill> : <StatusPill tone="warning">Por cobrar</StatusPill>}
                {order.saleId && (
                  <span className="ml-auto inline-flex items-center gap-3">
                    <a href={`/api/pos/ticket/${order.saleId}?reprint=1`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                      <Printer className="size-3.5" /> Imprimir ticket
                    </a>
                    <Link href={`/admin/sales?q=PED-${order.orderNumber}`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                      <ReceiptText className="size-3.5" /> Ver venta PED-{order.orderNumber}
                    </Link>
                  </span>
                )}
              </div>
              {order.status === "cancelled" ? (
                <p className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <X className="size-4" /> Pedido cancelado
                </p>
              ) : (
                <ol className="flex items-start">
                  {flow.map((s, i) => {
                    const Icon = STEP_ICON[s] ?? Clock;
                    const done = i < current;
                    const now = i === current;
                    const at = reachedAt(s);
                    return (
                      <li key={s} className="relative flex flex-1 flex-col items-center text-center">
                        {i > 0 && (
                          <span className="absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 bg-muted">
                            <motion.span
                              className="block h-full bg-primary"
                              initial={reduce ? false : { width: 0 }}
                              animate={{ width: i <= current ? "100%" : "0%" }}
                              transition={{ duration: 0.5, delay: i * 0.08 }}
                            />
                          </span>
                        )}
                        <motion.span
                          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: i * 0.06 }}
                          className={cn(
                            "relative z-10 grid size-8 place-items-center rounded-full border-2 bg-background",
                            done && "border-primary bg-primary text-primary-foreground",
                            now && "border-primary text-primary",
                            !done && !now && "border-muted text-muted-foreground"
                          )}
                        >
                          <Icon className="size-4" />
                          {now && order.status !== "delivered" && <span className="absolute inset-0 animate-ping rounded-full border-2 border-primary/40 motion-reduce:hidden" />}
                        </motion.span>
                        <span className={cn("mt-1.5 text-xs leading-tight", now ? "font-semibold" : "text-muted-foreground")}>{ORDER_STATUS_LABELS[s]}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{at ? time(at) : " "}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
              <AnimatePresence mode="wait">
                <motion.p
                  key={order.status}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm",
                    needsSale ? "bg-warning/10 text-warning-ink" : "bg-primary/5"
                  )}
                >
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    <b>¿Qué sigue?</b> {guidance(order)}
                  </span>
                </motion.p>
              </AnimatePresence>
              {needsSale && canManage && (
                <Button
                  size="sm"
                  className="mt-2"
                  disabled={saving}
                  onClick={() => void run(() => post(`/api/orders/${order.id}/sale`), "Venta registrada", false)}
                >
                  <ReceiptText className="size-4" /> Registrar venta PED-{order.orderNumber}
                </Button>
              )}
            </section>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              {/* Productos y totales */}
              <section className="rounded-2xl border bg-card">
                <h4 className="border-b px-4 py-2.5 text-sm font-semibold">
                  {order.items.length} producto{order.items.length === 1 ? "" : "s"}
                </h4>
                <ul className="divide-y">
                  {order.items.map((it) => (
                    <li key={it.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold tabular-nums">
                        {it.bulkQuantityDisplay ?? `${it.quantity}×`}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {it.productName}
                          {it.variantName && it.variantName !== "Default" ? <span className="text-muted-foreground"> · {it.variantName}</span> : null}
                        </p>
                        {it.comment && <p className="text-xs italic text-muted-foreground">“{it.comment}”</p>}
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">{money(it.lineTotal)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="space-y-1 border-t px-4 py-3 text-sm">
                  <Row label="Subtotal" value={order.subtotal} />
                  {order.discount > 0 && <Row label="Descuentos" value={-order.discount} tone="text-success-ink" />}
                  {taxes > 0.009 && <Row label="Impuestos" value={taxes} />}
                  {order.deliveryFee > 0 && <Row label={delivery ? "Envío" : "Cargo por recoger"} value={order.deliveryFee} />}
                  {order.tip > 0 && <Row label="Propina" value={order.tip} />}
                  {order.pointsValue > 0 && <Row label="Pagado con puntos" value={-order.pointsValue} tone="text-success-ink" />}
                  <div className="flex justify-between border-t pt-2 text-base font-bold">
                    <dt>Total</dt>
                    <dd className="tabular-nums">{money(order.total)}</dd>
                  </div>
                </dl>
              </section>

              <div className="space-y-4">
                {/* Cliente */}
                <section className="rounded-2xl border bg-card p-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente</p>
                  <p className="mt-1 font-semibold">{order.customerName ?? "Sin cliente registrado"}</p>
                  {phoneDigits && (
                    <div className="mt-2 flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <a href={`tel:${phoneDigits}`}>
                          <Phone className="size-3.5" /> Llamar
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <a href={`https://wa.me/${phoneDigits.length === 10 ? `52${phoneDigits}` : phoneDigits}`} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="size-3.5" /> WhatsApp
                        </a>
                      </Button>
                    </div>
                  )}
                  {order.notes && <p className="mt-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs italic">“{order.notes}”</p>}
                </section>

                {/* Entrega */}
                <section className="rounded-2xl border bg-card p-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{delivery ? "Entrega a domicilio" : "Recoge en"}</p>
                  {order.locationName && (
                    <p className="mt-1 flex items-center gap-1.5">
                      <Store className="size-3.5 text-muted-foreground" /> {order.locationName}
                    </p>
                  )}
                  {delivery && order.address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 flex items-start gap-1.5 text-primary hover:underline"
                    >
                      <MapPin className="mt-0.5 size-3.5 shrink-0" /> {order.address}
                    </a>
                  )}
                </section>

                {/* Pago */}
                <section className="rounded-2xl border bg-card p-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pago</p>
                  <p className="mt-1 flex items-center gap-1.5">
                    <Wallet className="size-3.5 text-muted-foreground" />
                    {order.paymentMethod ? PAY_LABELS[order.paymentMethod] ?? order.paymentMethod : "Por definir"}
                    {order.paymentReference ? <span className="text-muted-foreground"> · {order.paymentReference}</span> : null}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {order.saleId
                      ? `Venta PED-${order.orderNumber} registrada en caja.`
                      : order.isTableOrder
                        ? "Se cobra en el POS con la cuenta de la mesa."
                        : order.isPaid
                          ? "Pagado. La venta se registra al entregar."
                          : "Se cobra al entregar; la venta se registra en la caja abierta de la sucursal."}
                  </p>
                </section>
              </div>
            </div>

            {/* Historial */}
            {order.history.length > 0 && (
              <section className="rounded-2xl border bg-card p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Historial</p>
                <ol className="space-y-2 border-l pl-4">
                  {order.history.map((h) => (
                    <li key={h.id} className="relative text-sm">
                      <span className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-primary" />
                      <p className="font-medium">
                        {ORDER_STATUS_LABELS[h.status as OrderStatusKey] ?? h.status}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">{shortDate(h.createdAt)}</span>
                      </p>
                      {(h.employeeName || h.notes) && (
                        <p className="text-xs text-muted-foreground">{[h.employeeName, h.notes].filter(Boolean).join(" · ")}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </>
        )}
      </DialogComponent>

      {order && (
        <DeliveryConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          orderId={order.id}
          orderNumber={order.orderNumber}
          mode={delivery ? "delivery" : "pickup"}
          onConfirmed={() => {
            swalToast(delivery ? "Pedido entregado" : "Pedido recogido");
            close();
          }}
        />
      )}
      {order && (
        <OrderPaymentDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          order={order}
          onPaid={() => {
            swalToast("Cobro registrado");
            void load();
            onChanged?.();
          }}
        />
      )}
    </>
  );
}

function Row({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className={cn("flex justify-between text-muted-foreground", tone)}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value < 0 ? `−${money(-value)}` : money(value)}</dd>
    </div>
  );
}
