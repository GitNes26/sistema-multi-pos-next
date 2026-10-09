"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { salesApi, type ReturnSettlement, type SaleDetail, type SaleReturn } from "@/lib/api"
import { ReturnCustomerBlock } from "./return-customer-block"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import { Input } from "@/components/ui/input"
import { DialogComponent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertTriangle, Hash, Loader2, MessageSquare, Minus, Plus, Search, Trash2, Undo2 } from "lucide-react"
import { cleanItemName } from "@/lib/pos/item-name"
import { InputGroupField } from "@/components/base/input-group-field"

const RETURN_TYPES = [
  {
    value: "refund",
    label: "Devolución de dinero",
    desc: "Se reembolsa el efectivo/tarjeta al cliente",
  },
  {
    value: "coupon",
    label: "Cupón de descuento",
    desc: "Se genera un cupón para uso futuro",
  },
  {
    value: "bonus",
    label: "Bonificar al cliente",
    desc: "Se abona el monto en puntos de lealtad o a su crédito",
  },
  {
    value: "exchange",
    label: "Cambio por otro producto",
    desc: "Se reemplaza el producto defectuoso",
  },
] as const

interface ExchangeOption {
  productId: string
  variantId: string
  name: string
  price: number
  stock: number | null
}

interface ExchangeLine extends ExchangeOption {
  quantity: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  sale: SaleDetail
  onCreated?: () => void
}

export function ReturnDialog({ open, onOpenChange, sale, onCreated }: Props) {
  const [returnType, setReturnType] = useState<string>("refund")
  // «Bonificar al cliente» se resuelve en puntos o en crédito, según lo que el negocio tenga habilitado.
  const [bonusTarget, setBonusTarget] = useState<"points" | "credit">("points")
  const [assignedCustomerId, setAssignedCustomerId] = useState("")
  const [ctx, setCtx] = useState<(ReturnSettlement & { saleHasCustomer: boolean }) | null>(null)
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({})
  const [itemReasons, setItemReasons] = useState<Record<string, string>>({})
  const [restockable, setRestockable] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [existingReturns, setExistingReturns] = useState<SaleReturn[]>([])
  const [exchange, setExchange] = useState<ExchangeLine[]>([])
  const [exchangeQuery, setExchangeQuery] = useState("")
  const [exchangeOptions, setExchangeOptions] = useState<ExchangeOption[]>([])
  const [searching, setSearching] = useState(false)

  // Cargar devoluciones existentes
  useEffect(() => {
    if (open && sale.id) {
      salesApi.saleReturns(sale.id).then((res) => {
        if (res.ok) setExistingReturns(res.returns)
      })
    }
  }, [open, sale.id])

  // Opciones habilitadas y cliente (el de la venta o el que se asigne aquí).
  useEffect(() => {
    if (!open || !sale.id) return
    let cancelled = false
    salesApi
      .returnContext(sale.id, assignedCustomerId || null)
      .then((res) => {
        if (!cancelled && res.ok) setCtx(res.context)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open, sale.id, assignedCustomerId])

  const loyaltyOn = ctx?.loyaltyEnabled ?? false
  const creditOn = ctx?.creditEnabled ?? false
  const bonusAvailable = loyaltyOn || creditOn
  const effectiveBonus: "points" | "credit" = bonusTarget === "credit" && creditOn ? "credit" : loyaltyOn ? "points" : "credit"
  const returnTypes = RETURN_TYPES.filter((t) => t.value !== "bonus" || bonusAvailable)

  // Buscar productos para el cambio (con su existencia en la sucursal de la venta)
  useEffect(() => {
    if (!open || returnType !== "exchange") return
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(() => {
      fetch(`/api/sales/${sale.id}/exchange-options?q=${encodeURIComponent(exchangeQuery)}`)
        .then((r) => r.json())
        .then((res) => {
          if (!cancelled && res.ok) setExchangeOptions(res.options)
        })
        .catch(() => {})
        .finally(() => !cancelled && setSearching(false))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, returnType, exchangeQuery, sale.id])

  // «+1» flotante sobre el producto recién agregado (la lista de abajo no siempre se ve).
  const [flash, setFlash] = useState<{ id: string; n: number } | null>(null)
  const addExchange = (o: ExchangeOption) => {
    setFlash((f) => ({ id: o.variantId, n: (f?.n ?? 0) + 1 }))
    setExchange((prev) =>
      prev.some((l) => l.variantId === o.variantId)
        ? prev.map((l) => (l.variantId === o.variantId ? { ...l, quantity: l.quantity + 1 } : l))
        : [...prev, { ...o, quantity: 1 }]
    )
  }
  const setExchangeQty = (variantId: string, quantity: number) =>
    setExchange((prev) =>
      quantity < 1 ? prev.filter((l) => l.variantId !== variantId) : prev.map((l) => (l.variantId === variantId ? { ...l, quantity } : l))
    )
  /** Escribir la cantidad no elimina la línea; al salir del campo con 0 sí se quita. */
  const typeExchangeQty = (variantId: string, quantity: number) =>
    setExchange((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.max(0, Math.floor(quantity) || 0) } : l)))
  const exchangeTotal = exchange.reduce((acc, l) => acc + l.quantity * l.price, 0)
  const exchangeNoStock = exchange.filter((l) => l.stock != null && l.stock < l.quantity)

  // Calcular cuánto se ha devuelto de cada item
  const getReturnedQty = useCallback(
    (saleItemId: string) =>
      existingReturns
        .filter((r) => r.status !== "rejected")
        .reduce((acc, ret) => {
          const ri = ret.items.find((i) => i.saleItemId === saleItemId)
          return acc + (ri ? ri.quantity : 0)
        }, 0),
    [existingReturns]
  )

  const handleToggleItem = (saleItemId: string, maxQty: number) => {
    setSelectedItems((prev) => {
      const next = { ...prev }
      if (saleItemId in next) {
        delete next[saleItemId]
      } else {
        next[saleItemId] = maxQty
      }
      return next
    })
  }

  const handleQtyChange = (saleItemId: string, qty: number) => {
    // Vaciar el campo no desmarca el producto: la cantidad queda en 0 hasta que se escriba otra.
    setSelectedItems((prev) => ({ ...prev, [saleItemId]: Number.isFinite(qty) ? Math.max(0, qty) : 0 }))
  }

  // Precio realmente pagado por unidad (ya con la parte proporcional del descuento).
  const paidUnit = (item: SaleDetail["items"][number]) => {
    const q = Number(item.quantity) || 1
    const line = item.lineTotal != null
      ? Number(item.lineTotal)
      : Math.max(0, (item.totalPrice != null ? Number(item.totalPrice) : q * Number(item.unitPrice)) - Number(item.discount ?? 0))
    return line / q
  }

  const selectedTotal = Object.entries(selectedItems).reduce(
    (acc, [itemId, qty]) => {
      const item = sale.items.find((i) => i.id === itemId)
      if (!item || qty <= 0) return acc
      return acc + qty * paidUnit(item)
    },
    0
  )

  const chosenCount = Object.values(selectedItems).filter((q) => q > 0).length
  const bonusMode = returnType === "bonus"
  const creditShort = bonusMode && effectiveBonus === "credit" && !!ctx?.customer && selectedTotal - ctx.customer.creditBalance > 0.009
  const needsCustomer = bonusMode && !ctx?.customer

  const handleSubmit = async () => {
    const items = Object.entries(selectedItems)
      .filter(([, qty]) => qty > 0)
      .map(([saleItemId, quantity]) => {
        const item = sale.items.find((i) => i.id === saleItemId)!
        const returned = getReturnedQty(saleItemId)
        const maxReturnable = Number(item.quantity) - returned
        return {
          saleItemId,
          quantity: Math.min(quantity, maxReturnable),
          reason: itemReasons[saleItemId] || undefined,
          restockable: restockable[saleItemId] ?? true,
        }
      })

    if (items.length === 0) {
      toast.error("Selecciona al menos un producto para devolver")
      return
    }

    if (bonusMode) {
      if (needsCustomer) {
        toast.error("Asigna o registra al cliente a quien se bonificará")
        return
      }
      if (creditShort) {
        toast.error("El adeudo del cliente es menor que la devolución", { description: "Usa devolución de dinero o bonifica en puntos." })
        return
      }
    }

    if (returnType === "exchange") {
      if (exchange.filter((l) => l.quantity > 0).length === 0) {
        toast.error("Elige el producto que se entregará a cambio")
        return
      }
      if (exchangeNoStock.length > 0) {
        toast.error(`Sin existencia suficiente: ${exchangeNoStock.map((l) => l.name).join(", ")}`, {
          description: "Elige otro producto o repón el inventario antes de continuar.",
        })
        return
      }
    }

    setLoading(true)
    try {
      const res = await salesApi.createReturn(sale.id, {
        exchangeItems:
          returnType === "exchange"
            ? exchange.filter((l) => l.quantity > 0).map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity }))
            : undefined,
        returnType: (bonusMode ? effectiveBonus : returnType) as "exchange" | "refund" | "coupon" | "points" | "credit",
        customerId: bonusMode && ctx && !ctx.saleHasCustomer ? ctx.customer?.id ?? null : null,
        reason: reason || undefined,
        notes: notes || undefined,
        items,
      })
      if (res.ok) {
        const retId = res.return?.id
        toast.success("Devolución creada correctamente", {
          description: "Puedes revisar el estado en el tab de Devoluciones.",
          action: retId
            ? {
                label: "Ver devolución",
                onClick: () => {
                  onOpenChange(false)
                  onCreated?.()
                },
              }
            : undefined,
        })
        onOpenChange(false)
        setSelectedItems({})
        setAssignedCustomerId("")
        setExchange([])
        setReason("")
        setNotes("")
        onCreated?.()
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al crear devolución")
    } finally {
      setLoading(false)
    }
  }

  const money = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      icon={<Undo2 className="size-4" />}
      title={`Nueva devolución — Venta #${String(sale.locationSaleNumber ?? sale.saleNumber)}`}
      description="Crea una nueva devolución para esta venta. Puedes seleccionar los productos a devolver, el tipo de resolución y agregar notas internas."
      className="w-full"
      bodyClassName="space-y-3"
      size="4xl"
      footer={
        <>
          {/* Resumen */}
          {chosenCount > 0 && (
            <div className="rounded-lg bg-muted p-3 w-full lg:hidden">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Total a devolver:</span>
                <span className="font-bold text-lg tabular-nums">
                  {money(selectedTotal)}
                </span>
              </div>
              {returnType === "exchange" && exchange.length > 0 && (
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {exchangeTotal - selectedTotal > 0 ? "Cliente paga la diferencia" : "A favor del cliente (se le entrega al procesar)"}
                  </span>
                  <span className="font-semibold tabular-nums">{money(Math.abs(exchangeTotal - selectedTotal))}</span>
                </div>
              )}
            </div>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || chosenCount === 0 || (returnType === "exchange" && exchangeNoStock.length > 0) || creditShort}
          >
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Crear devolución
          </Button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="min-w-0 space-y-3">
      {/* Tipo de devolución */}
      <div className="space-y-2">
        <Label className="font-semibold">Tipo de resolución</Label>
        <RadioGroup
          value={returnType}
          onValueChange={(v) => {
            setReturnType(v)
            if (v === "bonus") setBonusTarget(loyaltyOn ? "points" : "credit")
          }}
          className="grid grid-cols-2 gap-2"
        >
          {returnTypes.map((t) => (
            <label
              key={t.value}
              className={`flex flex-col rounded-lg border p-3 cursor-pointer transition-colors ${
                returnType === t.value
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted"
              }`}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value={t.value} />
                <span className="text-sm font-medium">{t.label}</span>
              </div>
              <span className="text-xs text-muted-foreground ml-6">
                {t.desc}
              </span>
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Productos */}
      <div className="space-y-2">
        <Label className="font-semibold">Productos a devolver</Label>
        <div className="space-y-2">
          {sale.items.map((item) => {
            const returned = getReturnedQty(item.id)
            const maxReturnable = Number(item.quantity) - returned
            if (maxReturnable <= 0) return null
            const isSelected = item.id in selectedItems

            return (
              <div
                key={item.id}
                className={`rounded-lg border p-3 transition-colors ${
                  isSelected ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`item-${item.id}`}
                    checked={isSelected}
                    onCheckedChange={() =>
                      handleToggleItem(item.id, maxReturnable)
                    }
                  />

                  <div className="flex-1 min-w-0 overflow-hidden">
                    <Label
                      htmlFor={`item-${item.id}`}
                      className="flex items-start justify-between gap-2 cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium break-words">
                          {cleanItemName(item.productName, item.productType)}
                        </p>
                        {item.variantName && (
                          <p className="text-xs text-muted-foreground break-words">
                            {item.variantName}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-right text-sm font-medium tabular-nums">
                        {money(paidUnit(item))}
                        {Math.abs(paidUnit(item) - Number(item.unitPrice)) > 0.009 && (
                          <span className="block text-xs font-normal text-muted-foreground line-through">{money(Number(item.unitPrice))}</span>
                        )}
                      </span>
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Vendidos: {Number(item.quantity)} · Ya devueltos:{" "}
                      {returned} · Disponible: {maxReturnable}
                    </p>

                    {isSelected && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <InputGroupField
                            label="Cantidad"
                            type="number"
                            min={1}
                            max={maxReturnable}
                            inputMode="decimal"
                            value={selectedItems[item.id] ? selectedItems[item.id] : ""}
                            onChange={(e) =>
                              handleQtyChange(item.id, e.target.value === "" ? 0 : Number(e.target.value))
                            }
                            leftIcon={<Hash className="size-4" />}
                            className="h-8 w-20 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">
                            ={" "}
                            {money((selectedItems[item.id] ?? 0) * paidUnit(item))}
                          </span>
                        </div>
                        <InputGroupField
                          label="Motivo"
                          placeholder="Motivo de devolución de este producto..."
                          value={itemReasons[item.id] ?? ""}
                          onChange={(e) =>
                            setItemReasons((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          leftIcon={<MessageSquare className="size-4" />}
                          className="h-8 text-xs"
                        />
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Checkbox
                            checked={restockable[item.id] ?? true}
                            onCheckedChange={(c) =>
                              setRestockable((prev) => ({
                                ...prev,
                                [item.id]: c === true,
                              }))
                            }
                          />
                          Re-estacionar (devolver al stock)
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Motivo general */}
      <div className="space-y-2">
        <InputGroupField
          label="Motivo general (opcional)"
          placeholder="Ej: Producto defectuoso, error en pedido..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          leftIcon={<MessageSquare className="size-4" />}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="returnNotes">Notas internas (opcional)</Label>
        <Textarea
          id="returnNotes"
          placeholder="Notas para el equipo..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>
        </div>
        <aside className="min-w-0 space-y-3 lg:sticky lg:top-0 lg:self-start">
      {returnType === "bonus" && (
        <div className="space-y-3 rounded-xl border bg-card p-3">
          {loyaltyOn && creditOn && (
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Destino de la bonificación">
              {(["points", "credit"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={effectiveBonus === t}
                  onClick={() => setBonusTarget(t)}
                  className={cn("h-10 rounded-md text-sm font-medium transition-colors", effectiveBonus === t ? "bg-background shadow-sm" : "text-muted-foreground")}
                >
                  {t === "points" ? "En puntos" : "A crédito"}
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {effectiveBonus === "points"
              ? `Se convierte con la política de lealtad (${ctx?.pointsPerCurrency ?? 1} punto por cada $1).`
              : "Se abona como pago a la deuda de crédito del cliente."}
          </p>
          <ReturnCustomerBlock
            ctx={ctx}
            saleHasCustomer={ctx?.saleHasCustomer ?? false}
            customerId={assignedCustomerId}
            onCustomerChange={setAssignedCustomerId}
            pointsMoney={effectiveBonus === "points" ? selectedTotal : 0}
            creditMoney={effectiveBonus === "credit" ? selectedTotal : 0}
          />
          {creditShort && (
            <p className="flex items-start gap-1.5 text-xs font-medium text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> El adeudo actual ({money(ctx?.customer?.creditBalance ?? 0)}) es menor que la devolución. Elige puntos o devolución de dinero.
            </p>
          )}
        </div>
      )}

      {returnType === "exchange" && (
        <div className="space-y-2">
          <Label className="font-semibold">Producto que se entrega a cambio</Label>
          <InputGroupField
            type="search"
            placeholder="Buscar producto, SKU o código..."
            value={exchangeQuery}
            onChange={(e) => setExchangeQuery(e.target.value)}
            leftIcon={searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          />
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border p-1">
            {exchangeOptions.length === 0 && (
              <p className="p-3 text-center text-xs text-muted-foreground">{searching ? "Buscando…" : "Sin resultados"}</p>
            )}
            {exchangeOptions.map((o) => {
              const out = o.stock != null && o.stock <= 0
              const inCart = exchange.find((l) => l.variantId === o.variantId)
              return (
                <button
                  key={o.variantId}
                  type="button"
                  onClick={() => addExchange(o)}
                  className="relative flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted active:bg-primary/10"
                >
                  <span className="min-w-0 truncate">
                    {o.name}
                    {inCart && <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 text-xs font-semibold text-primary">×{inCart.quantity}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
                    <span className={out ? "font-semibold text-destructive" : "text-muted-foreground"}>
                      {o.stock == null ? "Sin control" : out ? "Sin existencia" : `${o.stock} disp.`}
                    </span>
                    <span className="font-semibold">{money(o.price)}</span>
                  </span>
                  <AnimatePresence>
                    {flash?.id === o.variantId && (
                      <motion.span
                        key={flash.n}
                        initial={{ opacity: 1, y: 0, scale: 0.8 }}
                        animate={{ opacity: 0, y: -22, scale: 1.15 }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                        className="pointer-events-none absolute top-1 right-16 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground"
                      >
                        +1
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              )
            })}
          </div>
          {exchange.length === 0 && (
            <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">Toca un producto para agregarlo al cambio.</p>
          )}
          {exchange.map((l) => {
            const short = l.stock != null && l.stock < l.quantity
            return (
              <motion.div
                key={l.variantId}
                layout
                animate={flash?.id === l.variantId ? { scale: [1, 1.025, 1] } : { scale: 1 }}
                transition={{ duration: 0.25 }}
                className={`rounded-lg border p-2 ${short ? "border-destructive/50 bg-destructive/5" : "border-primary bg-primary/5"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{l.name}</span>
                  <div className="flex items-center rounded-lg bg-muted p-0.5">
                    <button type="button" className="flex size-9 items-center justify-center rounded-md hover:bg-background" aria-label="Disminuir" onClick={() => setExchangeQty(l.variantId, l.quantity - 1)}>
                      {l.quantity <= 1 ? <Trash2 className="size-4 text-destructive" /> : <Minus className="size-4" />}
                    </button>
                    <Input
                      aria-label={`Cantidad de ${l.name}`}
                      inputMode="numeric"
                      value={l.quantity || ""}
                      onChange={(e) => typeExchangeQty(l.variantId, Number(e.target.value.replace(/\D/g, "")))}
                      onFocus={(e) => e.currentTarget.select()}
                      onBlur={() => l.quantity < 1 && setExchangeQty(l.variantId, 0)}
                      className="h-9 w-12 border-0 bg-transparent px-1 text-center text-sm font-semibold tabular-nums shadow-none"
                    />
                    <button type="button" className="flex size-9 items-center justify-center rounded-md hover:bg-background" aria-label="Aumentar" onClick={() => setExchangeQty(l.variantId, l.quantity + 1)}>
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <span className="w-20 text-right text-sm font-semibold tabular-nums">{money(l.quantity * l.price)}</span>
                </div>
                {short && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-destructive">
                    <AlertTriangle className="size-3.5" /> Solo hay {l.stock} en existencia. No se podrá entregar el cambio.
                  </p>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Resumen en vivo (columna derecha, como en el cobro) */}
      <div className="space-y-1.5 rounded-xl border bg-muted/40 p-3 text-sm">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Resumen</p>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Productos a devolver ({chosenCount})</span>
          <span className="font-semibold tabular-nums">{money(selectedTotal)}</span>
        </div>
        {returnType === "exchange" && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Producto de cambio</span>
            <span className="font-semibold tabular-nums">{money(exchangeTotal)}</span>
          </div>
        )}
        {returnType === "exchange" && exchange.length > 0 && Math.abs(exchangeTotal - selectedTotal) > 0.009 && (
          <div
            role="status"
            className={cn(
              "mt-1 flex items-start gap-2 rounded-lg p-2 text-xs font-medium",
              exchangeTotal > selectedTotal ? "bg-warning/15 text-warning-ink" : "bg-success/10 text-success-ink"
            )}
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {exchangeTotal > selectedTotal
                ? `El cambio excede el monto a canjear por ${money(exchangeTotal - selectedTotal)}: el cliente pagará la diferencia al procesar.`
                : `Al cliente le quedan ${money(selectedTotal - exchangeTotal)} a favor: se le entregan en efectivo desde la caja${loyaltyOn ? ", en puntos" : ""}${creditOn ? " o a su crédito" : ""}.`}
            </span>
          </div>
        )}
        <div className="flex justify-between border-t pt-1.5 text-base font-bold">
          <span>{returnType === "exchange" ? "Diferencia" : "Total a devolver"}</span>
          <span className="tabular-nums">{money(returnType === "exchange" ? Math.abs(exchangeTotal - selectedTotal) : selectedTotal)}</span>
        </div>
      </div>
        </aside>
      </div>
    </DialogComponent>
  )
}
