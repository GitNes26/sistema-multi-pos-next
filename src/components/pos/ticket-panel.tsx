"use client"

import { useEffect, useRef, useState } from "react"
import {
  CheckCircle2,
  ChefHat,
  Loader2,
  RotateCcw,
  TicketPercent,
  UserRound,
  Wallet,
  Sparkles,
  Split,
  Armchair,
  AlertTriangle,
  X,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { swalToast } from "@/lib/swal"
import { usePosStore, selectCustomer } from "@/stores/pos-store"
import { usePosTotals } from "@/hooks/use-pos-totals"
import type { PosLineItem } from "@/types/pos"
import { money } from "@/lib/pos/money"
import { pointsToMoney } from "@/lib/pos/pricing"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AnimatedNumber } from "@/components/base/animated-number"
import { TicketItemRow } from "./ticket-item-row"
import { SPRING_LAYOUT } from "@/lib/animation-tokens"
import { TableSelector } from "./table-selector"
import { KitchenStatus } from "./kitchen-status"

interface TicketPanelProps {
  onEditBulk: (item: PosLineItem) => void
  onOpenCustomer: () => void
  onOpenDiscount: () => void
  onCheckout: () => void
  onSplitBill?: (parts: number) => void
}

export function TicketPanel({
  onEditBulk,
  onOpenCustomer,
  onOpenDiscount,
  onCheckout,
  onSplitBill,
}: TicketPanelProps) {
  const items = usePosStore((s) => s.items)
  const customerId = usePosStore((s) => s.customerId)
  const promotions = usePosStore((s) => s.promotions)
  const clearTicket = usePosStore((s) => s.clearTicket)
  const setQty = usePosStore((s) => s.setQty)
  const removeItem = usePosStore((s) => s.removeItem)
  const features = usePosStore((s) => s.features)
  const selectedTable = usePosStore((s) => s.selectedTable)
  const setTable = usePosStore((s) => s.setTable)
  const markSent = usePosStore((s) => s.markSent)
  const resetSent = usePosStore((s) => s.resetSent)

  // Enviar a cocina: líneas del ticket aún no enviadas (qty > sentQty).
  const unsentLines = items.filter((i) => i.qty > (i.sentQty ?? 0))
  const anySent = items.some((i) => (i.sentQty ?? 0) > 0)
  const [sendingKitchen, setSendingKitchen] = useState(false)
  const [kitchenError, setKitchenError] = useState<string | null>(null)
  const [lastSent, setLastSent] = useState<{ orderNumber: number; at: number } | null>(null)
  useEffect(() => {
    if (!lastSent) return
    const t = setTimeout(() => setLastSent(null), 4000)
    return () => clearTimeout(t)
  }, [lastSent])

  const t = usePosTotals()
  const customer = selectCustomer(customerId)
  const loyalty = usePosStore((s) => s.loyalty)

  // Customer credit balance
  const [customerDebt, setCustomerDebt] = useState<number | null>(null)
  useEffect(() => {
    if (customerId) {
      fetch(`/api/customer-credit?customerId=${customerId}`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok && d.credit) setCustomerDebt(Number(d.credit.currentBalance))
          else setCustomerDebt(null)
        })
        .catch(() => setCustomerDebt(null))
    } else {
      setCustomerDebt(null)
    }
  }, [customerId])

  const listRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const prevCountRef = useRef(0)
  const [flash, setFlash] = useState<{ key: string; nonce: number }>({
    key: "",
    nonce: 0,
  })
  const [justAdded, setJustAdded] = useState(false)
  const [tableDialogOpen, setTableDialogOpen] = useState(false)
  const [releasingTable, setReleasingTable] = useState(false)

  const sendToKitchen = async () => {
    if (!selectedTable || sendingKitchen || unsentLines.length === 0) return
    setSendingKitchen(true)
    setKitchenError(null)
    try {
      const locationId = usePosStore.getState().location.id
      const res = await fetch("/api/pos/kitchen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: selectedTable.id,
          locationId,
          customerId,
          items: unsentLines.map((i) => ({
            key: i.key,
            productId: i.productId,
            variantId: i.variantId,
            productName: i.name,
            productType: i.kind === "bulk" ? "bulk" : "standard",
            quantity: i.qty - (i.sentQty ?? 0),
            unitId: i.unitId,
            unitPrice: i.unitPrice,
            bulkQuantityDisplay: i.bulkQuantityDisplay,
            taxRate: i.taxRate,
            notes: i.notes,
            selectedOptions: i.selectedOptions,
            extraPrice: i.extraPrice,
          })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo enviar a cocina")
      unsentLines.forEach((i) => markSent(i.key, i.qty))
      setLastSent({ orderNumber: data.orderNumber, at: Date.now() })
    } catch (err) {
      setKitchenError(
        err instanceof Error ? err.message : "No se pudo enviar a cocina"
      )
    } finally {
      setSendingKitchen(false)
    }
  }

  // Auto-scroll al fondo solo cuando se AGREGA un producto nuevo
  useEffect(() => {
    const el = listRef.current
    if (el && items.length > prevCountRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
      setJustAdded(true)
      setTimeout(() => setJustAdded(false), 600)
    }
    prevCountRef.current = items.length
  }, [items])

  const notifyChange = (key: string) => {
    setFlash((prev) => ({ key, nonce: prev.nonce + 1 }))
    rowRefs.current[key]?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    })
  }

  const increment = (key: string) => {
    const item = items.find((i) => i.key === key)
    if (!item) return
    if (item.kind === "bulk") {
      onEditBulk(item)
      return
    }
    if (item.trackInventory && item.qty + 1 > Math.floor(item.stock)) return
    setQty(key, item.qty + 1)
    notifyChange(key)
  }

  /** Cantidad escrita a mano (p. ej. 50 piezas): respeta la existencia. */
  const setItemQty = (key: string, qty: number) => {
    const item = items.find((i) => i.key === key)
    if (!item) return
    let next = Math.max(1, Math.floor(qty))
    if (item.trackInventory && next > Math.floor(item.stock)) {
      next = Math.max(1, Math.floor(item.stock))
      swalToast(`Solo hay ${next} en existencia`, "warning")
    }
    setQty(key, next)
    notifyChange(key)
  }

  const decrement = (key: string) => {
    const item = items.find((i) => i.key === key)
    if (!item) return
    if (item.qty <= 1) {
      removeItem(key)
      return
    }
    setQty(key, item.qty - 1)
    notifyChange(key)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-base font-semibold tracking-tight">Ticket</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular">
            {items.length} {items.length === 1 ? "artículo" : "artículos"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={!items.length}
          onClick={clearTicket}
          className="text-muted-foreground hover:text-destructive"
        >
          <RotateCcw className="size-4" />
          Limpiar
        </Button>
      </div>

      {/* Items list */}
      <div
        ref={listRef}
        className="scrollbar-none flex-1 space-y-2 overflow-y-auto p-3"
      >
        <AnimatePresence mode="popLayout">
          {items.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground"
            >
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
                <Wallet className="size-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">Ticket vacío</p>
                <p className="max-w-56 text-sm text-muted-foreground">
                  Toca un producto o escanea su código de barras para empezar.
                </p>
              </div>
            </motion.div>
          ) : (
            items.map((item) => (
              <motion.div
                key={item.key}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: -100, scale: 0.9 }}
                transition={SPRING_LAYOUT}
              >
                <TicketItemRow
                  item={item}
                  itemRef={(el) => {
                    rowRefs.current[item.key] = el
                  }}
                  flashNonce={flash.key === item.key ? flash.nonce : 0}
                  onIncrement={increment}
                  onDecrement={decrement}
                  onRemove={removeItem}
                  onSetQty={setItemQty}
                  onEdit={onEditBulk}
                />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Totals + actions — fixed bottom */}
      <div className="space-y-3 border-t bg-card px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
        {/* Discounts */}
        <AnimatePresence>
          {t.discounts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1"
            >
              {t.discounts.map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs text-success-ink"
                >
                  <span className="truncate">{d.label}</span>
                  <span className="font-medium">-{money(d.amount)}</span>
                </div>
              ))}
            </motion.div>
          )}
          {t.pointsRedeemedValue > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-between text-xs text-primary"
            >
              <span>Puntos canjeados ({Math.floor(t.pointsRedeemed)})</span>
              <span className="font-medium">
                -{money(t.pointsRedeemedValue)}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Summary */}
        <div className="space-y-1.5 px-1">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{money(t.subtotal)}</span>
          </div>
          {t.discountTotal > 0 && (
            <div className="flex justify-between text-sm text-success-ink">
              <span>Descuentos</span>
              <span className="tabular-nums">-{money(t.discountTotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Impuestos</span>
            <span className="tabular-nums">{money(t.tax)}</span>
          </div>
          <div className="flex items-baseline justify-between border-t border-dashed pt-2.5">
            <span className="text-base font-semibold">Total</span>
            <AnimatedNumber
              value={t.total}
              format={money}
              className="text-3xl font-bold tracking-tight tabular-nums"
            />
          </div>
        </div>

        {/* Mesa: selector, cocina y estado (la fila de acciones tiene su botón) */}
        {features.tables && (
          <>
            <TableSelector
              open={tableDialogOpen}
              onClose={() => setTableDialogOpen(false)}
              onSelect={(t) => setTable(t)}
            />

            {/* Cocina: orden abierta de la mesa + estado KDS en vivo + cancelar */}
            <KitchenStatus
              tableId={selectedTable && !selectedTable.id.startsWith("manual-") ? selectedTable.id : null}
              refreshKey={lastSent?.at ?? 0}
              onKitchenOrderCancelled={resetSent}
            />

            {/* Enviar a cocina (solo mesas reales del mapa) */}
            {selectedTable &&
              !selectedTable.id.startsWith("manual-") &&
              (anySent || unsentLines.length > 0) && (
                <div className="space-y-1.5">
                  {unsentLines.length > 0 ? (
                    <Button
                      size="lg"
                      data-guide="pos-send-kitchen"
                      disabled={sendingKitchen}
                      onClick={sendToKitchen}
                      className="h-12 w-full bg-warning font-semibold text-warning-foreground hover:bg-warning/90 desk:h-11"
                    >
                      {sendingKitchen ? (
                        <Loader2 className="size-5 animate-spin" />
                      ) : (
                        <ChefHat className="size-5" />
                      )}
                      Enviar a cocina
                      <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs tabular">
                        {unsentLines.length}
                      </span>
                    </Button>
                  ) : (
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-success/30 bg-success/5 px-3 py-2 text-xs font-semibold text-success-ink">
                      <CheckCircle2 className="size-4" />
                      Enviado a cocina
                    </div>
                  )}
                  {kitchenError && (
                    <p className="text-center text-xs font-medium text-destructive">
                      {kitchenError}
                    </p>
                  )}
                  {lastSent && !kitchenError && (
                    <p className="text-center text-xs font-semibold text-success-ink">
                      Enviado · Pedido #{lastSent.orderNumber}
                    </p>
                  )}
                </div>
              )}
          </>
        )}

        {/* Acciones en un solo renglón: Cliente (con sus datos) · Descuento · Mesa · Dividir */}
        <div className="flex items-stretch gap-1.5">
          <button
            type="button"
            onClick={onOpenCustomer}
            className={cn(
              "flex h-12 min-w-0 flex-1 touch-manipulation items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium transition hover:bg-muted active:scale-[0.98] desk:h-10",
              customer && "border-accent/50 bg-accent/10 hover:bg-accent/15"
            )}
            aria-label={customer ? `Cliente: ${customer.fullName}. Cambiar` : "Seleccionar cliente"}
          >
            <UserRound className="size-4 shrink-0" />
            {customer ? (
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate">{customer.fullName}</span>
                <span className="flex items-center gap-1.5 text-xs font-normal tabular-nums text-muted-foreground">
                  <span className="text-warning-ink">
                    {Math.floor(customer.points)} pts · {money(pointsToMoney(customer.points, loyalty.pointValue))}
                  </span>
                  {customerDebt != null && customerDebt > 0 && (
                    <span className="inline-flex items-center gap-0.5 font-semibold text-destructive">
                      <AlertTriangle className="size-3" /> Debe {money(customerDebt)}
                    </span>
                  )}
                </span>
              </span>
            ) : (
              <span>Cliente</span>
            )}
          </button>

          <Button
            variant="outline"
            onClick={onOpenDiscount}
            disabled={!items.length}
            className="h-12 shrink-0 gap-1.5 px-3 desk:h-10"
            aria-label="Aplicar descuento"
          >
            <TicketPercent className="size-4" />
            <span className="hidden min-[400px]:inline">Desc.</span>
          </Button>

          {features.tables && (
            <div className="flex shrink-0 items-stretch">
              <Button
                variant={selectedTable ? "default" : "outline"}
                data-guide="pos-table"
                onClick={() => setTableDialogOpen(true)}
                className={cn("h-12 gap-1.5 px-3 desk:h-10", selectedTable && "rounded-r-none")}
                aria-label={selectedTable ? `Mesa ${selectedTable.number}. Cambiar` : "Seleccionar mesa"}
              >
                <Armchair className="size-4" />
                {selectedTable ? selectedTable.number : <span className="hidden min-[400px]:inline">Mesa</span>}
              </Button>
              {selectedTable && (
                <Button
                  variant="outline"
                  className="h-12 w-10 rounded-l-none border-l-0 px-0 text-destructive desk:h-10"
                  aria-label="Liberar mesa"
                  disabled={releasingTable}
                  onClick={() => {
                    const tableId = selectedTable.id
                    if (!tableId.startsWith("manual-")) {
                      setReleasingTable(true)
                      fetch("/api/tables", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: tableId, status: "free" }),
                      })
                        .then((res) => {
                          if (!res.ok) throw new Error("No se pudo liberar la mesa");
                          // Cerrar sesión activa si existe
                          return fetch("/api/tables/session", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ tableId }),
                          });
                        })
                        .catch((err) => {
                          console.error("[ticket-panel] Error liberando mesa:", err);
                        })
                        .finally(() => setReleasingTable(false))
                    }
                    setTable(null)
                  }}
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          )}

          {features.splitBill && items.length > 0 && t.payable > 0 && onSplitBill && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-12 shrink-0 gap-1.5 px-3 desk:h-10" aria-label="Dividir la cuenta">
                  <Split className="size-4" />
                  <span className="hidden min-[400px]:inline">Dividir</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-2">
                <p className="px-1 pb-1.5 text-xs font-medium text-muted-foreground">Dividir entre</p>
                <div className="flex gap-1">
                  {[2, 3, 4, 5, 6].map((n) => (
                    <Button key={n} variant="outline" className="size-11 p-0 text-sm tabular" aria-label={`Dividir entre ${n}`} onClick={() => onSplitBill(n)}>
                      {n}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Checkout button */}
        <Button
          size="lg"
          data-guide="pos-checkout"
          disabled={!items.length || t.payable <= 0}
          onClick={onCheckout}
          className={cn(
            "relative h-16 w-full touch-manipulation rounded-2xl px-5 text-base font-semibold desk:h-14 desk:rounded-xl",
            t.payable > 0 && "shadow-e2"
          )}
        >
          <AnimatePresence mode="wait">
            {justAdded ? (
              <motion.span
                key="added"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2"
              >
                <Sparkles className="size-5" /> Agregado
              </motion.span>
            ) : (
              <motion.span
                key="cobrar"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex w-full items-center justify-between gap-3"
              >
                <span>Cobrar</span>
                <AnimatedNumber
                  value={t.payable}
                  format={money}
                  className="text-xl font-bold tracking-tight tabular-nums"
                />
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </div>
  )
}
