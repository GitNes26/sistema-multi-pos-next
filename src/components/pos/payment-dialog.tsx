"use client"

import { useEffect, useState } from "react"
import type { $Enums } from "@prisma/client"
import { AnimatePresence, motion } from "framer-motion"
import {
  Banknote,
  BadgeCheck,
  Check,
  CreditCard,
  Landmark,
  MoreHorizontal,
  PiggyBank,
  ReceiptText,
  Split,
  Trash2,
  Wallet,
  Zap,
  ListChecks,
  Loader2,
  RadioTower,
  XCircle,
} from "lucide-react"
import { DialogComponent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { AnimatedNumber } from "@/components/base/animated-number"
import { usePosStore } from "@/stores/pos-store"
import { usePosTotals } from "@/hooks/use-pos-totals"
import { money, round2 } from "@/lib/pos/money"
import { moneyToPoints, pointsToMoney } from "@/lib/pos/pricing"
import { playSound } from "@/lib/sounds"
import { buildSalePayload, type PaymentEntry } from "@/lib/pos/checkout"
import { CASH_DENOMINATIONS, PAYMENT_METHOD_LABELS } from "@/lib/pos/config"
import { Numpad, type NumpadKey } from "./numpad"
import { cn } from "@/lib/utils"

interface PaymentDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: (
    sale: { id: string; saleNumber: string; locationName: string },
    payload: ReturnType<typeof buildSalePayload>
  ) => void
  splitParts?: number | null
}

const METHODS: $Enums.PaymentMethod[] = ["cash", "card", "wallet", "credit", "other"]

const METHOD_ICONS: Partial<Record<$Enums.PaymentMethod, React.ReactNode>> = {
  cash: <Banknote className="size-5" />,
  card: <CreditCard className="size-5" />,
  wallet: <Wallet className="size-5" />,
  credit: <Landmark className="size-5" />,
  other: <MoreHorizontal className="size-5" />,
}

// Cada método conserva su matiz para reconocerlo de un vistazo en caja;
// seleccionado = sólido con su foreground, sin halos ni degradados.
const METHOD_COLORS: Record<string, { unselected: string; selected: string }> = {
  cash: {
    unselected: "border-success/40 text-success-ink hover:bg-success/10",
    selected: "border-success bg-success text-success-foreground shadow-e1",
  },
  card: {
    unselected: "border-info/40 text-info-ink hover:bg-info/10",
    selected: "border-info bg-info text-info-foreground shadow-e1",
  },
  wallet: {
    unselected: "border-violet-500/40 text-violet-700 hover:bg-violet-500/10 dark:text-violet-300",
    selected: "border-violet-600 bg-violet-600 text-white shadow-e1",
  },
  credit: {
    unselected: "border-warning/50 text-warning-ink hover:bg-warning/10",
    selected: "border-warning bg-warning text-warning-foreground shadow-e1",
  },
  other: {
    unselected: "border-border text-muted-foreground hover:bg-muted",
    selected: "border-foreground bg-foreground text-background shadow-e1",
  },
}

export function PaymentDialog({
  open,
  onClose,
  onSuccess,
  splitParts,
}: PaymentDialogProps) {
  const t = usePosTotals()
  const setPointsRedeemed = usePosStore((s) => s.setPointsRedeemed)
  const loyalty = usePosStore((s) => s.loyalty)

  const [tab, setTab] = useState<"quick" | "custom">("quick")
  const [method, setMethod] = useState<$Enums.PaymentMethod>("cash")
  const [cashStr, setCashStr] = useState("")
  const [entries, setEntries] = useState<PaymentEntry[]>([])
  const [pointsStr, setPointsStr] = useState("")
  const [reference, setReference] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [creditInfo, setCreditInfo] = useState<{ allowed: boolean; reason?: string; balance: number; limit: number | null } | null>(null)
  const [tipMode, setTipMode] = useState<"none" | "percent" | "custom">("none")
  const [tipPercent, setTipPercent] = useState(15)
  const [tipCustom, setTipCustom] = useState("")
  const [pointAvailable, setPointAvailable] = useState(false)
  const [pointOrder, setPointOrder] = useState<{ orderId: string; amount: number } | null>(null)
  const [pointStatus, setPointStatus] = useState("")
  const [pointBusy, setPointBusy] = useState(false)
  const features = usePosStore((s) => s.features)

  const maxPoints = t.customer
    ? Math.max(
        0,
        Math.min(
          Math.floor(t.customer.points),
          Math.ceil(moneyToPoints(t.total, loyalty.pointValue))
        )
      )
    : 0

  const tipAmount = tipMode === "percent" ? round2(t.subtotal * (tipPercent / 100)) : tipMode === "custom" ? round2(parseFloat(tipCustom.replace(",", ".")) || 0) : 0
  const totalWithTip = round2(t.payable + tipAmount)
  const paid = round2(entries.reduce((s, e) => s + e.amount, 0))
  const remaining = round2(Math.max(0, totalWithTip - paid))
  const change = round2(Math.max(0, paid - totalWithTip))
  const progress = totalWithTip > 0 ? Math.min(100, (paid / totalWithTip) * 100) : 0
  const currentAmount = parseFloat(cashStr.replace(",", ".")) || 0

  useEffect(() => {
    if (open) {
      setEntries([])
      setCashStr("")
      setPointsStr("")
      setReference("")
      setError("")
      setTab("quick")
      setTipMode("none")
      setTipPercent(15)
      setTipCustom("")
      setPointOrder(null)
      setPointStatus("")
      fetch("/api/pos/payments/mercadopago/point")
        .then((response) => response.json())
        .then((data: { available?: boolean }) => setPointAvailable(Boolean(data.available)))
        .catch(() => setPointAvailable(false))
    }
  }, [open])

  useEffect(() => {
    if (!pointOrder) return
    let active = true
    const poll = async () => {
      try {
        const response = await fetch(`/api/pos/payments/mercadopago/point?orderId=${encodeURIComponent(pointOrder.orderId)}`)
        const data = await response.json() as { payment?: { paid?: boolean; status?: string; statusDetail?: string }; error?: string }
        if (!response.ok) throw new Error(data.error ?? "No se pudo consultar la terminal")
        if (!active) return
        setPointStatus(data.payment?.statusDetail ?? data.payment?.status ?? "Esperando terminal")
        if (data.payment?.paid) {
          addPayment("card", pointOrder.amount, `mp_point:${pointOrder.orderId}`)
          setPointOrder(null)
          setPointStatus("Pago aprobado por Point")
          playSound("sale-complete")
        }
      } catch (pollError) {
        if (active) setError(pollError instanceof Error ? pollError.message : "No se pudo consultar la terminal")
      }
    }
    void poll()
    const timer = window.setInterval(poll, 2_500)
    return () => { active = false; window.clearInterval(timer) }
  // addPayment usa únicamente setters estables; no reiniciar el intervalo al cambiar el total.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointOrder])

  const startPointPayment = async () => {
    if (remaining <= 0 || pointBusy || pointOrder) return
    setPointBusy(true)
    setError("")
    try {
      const response = await fetch("/api/pos/payments/mercadopago/point", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: remaining, locationId: usePosStore.getState().location.id }),
      })
      const data = await response.json() as { payment?: { orderId: string; status?: string; statusDetail?: string }; error?: string }
      if (!response.ok || !data.payment?.orderId) throw new Error(data.error ?? "No se pudo enviar el cobro a Point")
      setPointOrder({ orderId: data.payment.orderId, amount: remaining })
      setPointStatus(data.payment.statusDetail ?? data.payment.status ?? "Enviado a la terminal")
    } catch (pointError) {
      setError(pointError instanceof Error ? pointError.message : "No se pudo enviar el cobro a Point")
    } finally {
      setPointBusy(false)
    }
  }

  const cancelPoint = async () => {
    if (!pointOrder || pointBusy) return
    setPointBusy(true)
    try {
      const response = await fetch(`/api/pos/payments/mercadopago/point?orderId=${encodeURIComponent(pointOrder.orderId)}`, { method: "DELETE" })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error ?? "No se pudo cancelar el cobro")
      setPointOrder(null)
      setPointStatus("")
    } catch (pointError) {
      setError(pointError instanceof Error ? pointError.message : "Cancela el cobro desde la terminal")
    } finally {
      setPointBusy(false)
    }
  }

  const onKey = (key: NumpadKey) => {
    if (key === "clear") return setCashStr("")
    if (key === "backspace") return setCashStr((s) => s.slice(0, -1))
    if (key === ".") {
      if (!cashStr.includes("."))
        setCashStr(cashStr === "" ? "0." : cashStr + ".")
      return
    }
    setCashStr(cashStr + key)
  }

  const applyPoints = (pts: number) => {
    setPointsRedeemed(Math.max(0, Math.min(pts, maxPoints)))
    setPointsStr("")
  }

  const addPayment = (m: $Enums.PaymentMethod, amount: number, paymentReference?: string) => {
    if (amount <= 0) return
    setEntries((prev) => [
      ...prev,
      {
        method: m,
        amount: round2(amount),
        reference: paymentReference ?? (reference.trim() || undefined),
      },
    ])
    setCashStr("")
    setReference("")
  }

  // Check credit eligibility when method changes to 'credit'
  useEffect(() => {
    if (method === "credit" && t.customer) {
      fetch(`/api/customer-credit?customerId=${t.customer.id}`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setCreditInfo({ allowed: d.canUse?.allowed ?? false, reason: d.canUse?.reason, balance: d.credit?.currentBalance ?? 0, limit: d.credit?.creditLimit })
        })
        .catch(() => setCreditInfo(null))
    } else if (method === "credit" && !t.customer) {
      setMethod("cash")
      setCreditInfo(null)
    } else {
      setCreditInfo(null)
    }
  }, [method, t.customer])

  const addCurrentPayment = () => {
    if (method === "credit" && creditInfo && !creditInfo.allowed) {
      setError(creditInfo.reason ?? "No se puede usar crédito")
      return
    }
    addPayment(method, currentAmount)
  }
  const addRemaining = (m: $Enums.PaymentMethod = method) => {
    if (m === "credit" && creditInfo && !creditInfo.allowed) {
      setError(creditInfo.reason ?? "No se puede usar crédito")
      return
    }
    addPayment(m, remaining)
  }
  const removeEntry = (i: number) =>
    setEntries((prev) => prev.filter((_, idx) => idx !== i))

  const complete = async () => {
    if (paid - totalWithTip < -0.01) {
      setError("Falta por cubrir el total")
      return
    }
    setLoading(true)
    setError("")
    try {
      const payload = buildSalePayload(t, entries, change, tipAmount)
      const res = await fetch("/api/pos/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: usePosStore.getState().location.id,
          payload,
        }),
      })
      const data = await res.json()
      if (!data.ok)
        throw new Error(data.error ?? "No se pudo registrar la venta")
      playSound("sale-complete")
      setEntries([])
      setCashStr("")
      setPointsStr("")
      setReference("")
      setError("")
      onSuccess(data.sale, payload)
    } catch (err) {
      playSound("error")
      setError(
        err instanceof Error ? err.message : "Error al registrar la venta"
      )
    } finally {
      setLoading(false)
    }
  }

  const TIP_PRESETS = [10, 15, 20, 25]

  // Tip selector block
  const tipBlock = features.tips && (
    <div className="space-y-2 rounded-xl border border-dashed border-success/40 bg-success/5 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-success-ink">
        💰 Propina (opcional)
      </p>
      <div className="grid grid-cols-5 gap-1.5">
        <button
          type="button"
          onClick={() => setTipMode("none")}
          className={cn(
            "rounded-lg border px-2 py-2 text-xs font-semibold transition",
            tipMode === "none"
              ? "border-success bg-success/10 text-success-ink"
              : "border-muted-foreground/20 text-muted-foreground hover:border-success/50"
          )}
        >
          Sin propina
        </button>
        {TIP_PRESETS.map((pct) => (
          <button
            key={pct}
            type="button"
            onClick={() => {
              setTipMode("percent")
              setTipPercent(pct)
            }}
            className={cn(
              "rounded-lg border px-2 py-2 text-xs font-semibold transition",
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
          variant="outline"
          size="sm"
          className="h-11 flex-1"
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
            className="h-11 w-28"
          />
        )}
      </div>
      {tipAmount > 0 && (
        <p className="text-xs text-success-ink">
          Propina: {money(tipAmount)} · Total con propina: <span className="font-bold">{money(totalWithTip)}</span>
        </p>
      )}
    </div>
  )

  // Bloque compartido de denominaciones (visible en ambas pestañas)
  const denominationsBlock = remaining > 0 && (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Denominaciones (efectivo)
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {CASH_DENOMINATIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => addPayment("cash", d)}
            className="press rounded-xl border bg-card py-4 text-base font-semibold tabular-nums hover:bg-muted"
          >
            ${d}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => {
        if (!o && !loading && !pointOrder) {
          setEntries([])
          setCashStr("")
          setPointsStr("")
          setReference("")
          setError("")
          onClose()
        }
      }}
      icon={<ReceiptText className="size-5 text-primary" />}
      title="Cobro de venta"
      description={
        <>
          {t.pointsRedeemed > 0 && (
            <>
              Aplicando {t.pointsRedeemed} pts ({money(t.pointsRedeemedValue)})
              en puntos ·{" "}
            </>
          )}
          {tipAmount > 0 ? (
            <>Restante: {money(totalWithTip)} (incluye {money(tipAmount)} propina)</>
          ) : (
            <>Restante: {money(t.payable)}</>
          )}
        </>
      }
      size="4xl"
      bodyClassName="space-y-3"
      footer={
        <Button
          size="lg"
          className="h-14 w-full rounded-2xl text-base font-semibold shadow-e2 desk:h-12 desk:rounded-xl"
          disabled={loading || Boolean(pointOrder) || paid - totalWithTip < -0.01}
          onClick={complete}
        >
          <BadgeCheck className="size-5" />
          {loading ? "Registrando…" : `Completar venta · ${money(totalWithTip)}`}
        </Button>
      }
    >
      {/* Split bill info */}
      {splitParts && splitParts > 1 && (
        <div className="rounded-xl border border-dashed p-3">
          <div className="flex items-center gap-2">
            <Split className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-xs font-semibold">
              Cuenta dividida en {splitParts} partes
            </span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground tabular">
            Cada persona paga: <span className="font-bold">{money(totalWithTip / splitParts)}</span>
            {' · '}Total a cobrar: <span className="font-bold">{money(totalWithTip)}</span>
          </p>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {/* ── Columna izquierda: acción de pago ───────────────────── */}
        <div className="space-y-3 md:col-span-2">
          {/* Total + progress */}
          <div className="rounded-2xl border bg-surface-sunken p-4">
            <div className="flex items-end justify-between">
              <span className="text-sm text-muted-foreground">
                Total a cobrar{tipAmount > 0 ? " + propina" : ""}
              </span>
              <AnimatedNumber
                value={totalWithTip}
                format={money}
                className="text-4xl font-bold tracking-tight tabular-nums"
              />
            </div>
            {tipAmount > 0 && (
              <p className="mt-1 text-right text-xs text-success-ink">
                Subtotal: {money(t.payable)} + Propina: {money(tipAmount)}
              </p>
            )}
            <Progress value={progress} className="mt-3 h-2.5 rounded-full" />
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted-foreground">
                Pagado{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {money(paid)}
                </span>
              </span>
              {remaining > 0 ? (
                <span className="font-semibold text-destructive tabular-nums">
                  Falta {money(remaining)}
                </span>
              ) : (
                <span className="font-semibold text-success-ink tabular-nums">
                  Cambio {money(change)}
                </span>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => setTab("quick")}
              className={cn(
                "flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                tab === "quick" ? "bg-card shadow-e1" : "text-muted-foreground"
              )}
            >
              <Zap className="size-4" /> Pago rápido
            </button>
            <button
              type="button"
              onClick={() => setTab("custom")}
              className={cn(
                "flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                tab === "custom" ? "bg-card shadow-e1" : "text-muted-foreground"
              )}
            >
              <Wallet className="size-4" /> Pago personalizado
            </button>
          </div>

          {/* Contenido de la pestaña */}
          <AnimatePresence mode="wait">
            {tab === "quick" ? (
              <motion.div
                key="quick"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                {/* Botones de pago rápido */}
                {remaining > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => addRemaining("cash")}
                      className={cn(
                        "press flex min-h-16 items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-base font-semibold",
                        METHOD_COLORS.cash.selected
                      )}
                    >
                      <Banknote className="size-5" />
                      Efectivo · {money(remaining)}
                    </button>
                    <button
                      type="button"
                      onClick={() => pointAvailable ? void startPointPayment() : addRemaining("card")}
                      disabled={pointBusy || Boolean(pointOrder)}
                      className={cn(
                        "press flex min-h-16 items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-base font-semibold",
                        METHOD_COLORS.card.selected
                      )}
                    >
                      {pointBusy ? <Loader2 className="size-5 animate-spin" /> : pointAvailable ? <RadioTower className="size-5" /> : <CreditCard className="size-5" />}
                      {pointAvailable ? "Cobrar con Point" : "Tarjeta"} · {money(remaining)}
                    </button>
                  </div>
                )}

                {tipBlock}
                {denominationsBlock}
              </motion.div>
            ) : (
              <motion.div
                key="custom"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                {/* Selector de método */}
                <div className={cn("grid gap-1.5", t.customer ? "grid-cols-4" : "grid-cols-3")}>
                  {METHODS.filter((m) => m !== "credit" || t.customer).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={cn(
                        "press flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-semibold",
                        method === m
                          ? METHOD_COLORS[m].selected
                          : METHOD_COLORS[m].unselected
                      )}
                    >
                      {METHOD_ICONS[m]}
                      {PAYMENT_METHOD_LABELS[m]}
                    </button>
                  ))}
                </div>

                {/* Numpad + importe */}
                <div className="grid grid-cols-2 gap-3">
                  <Numpad onKey={onKey} onEnter={addCurrentPayment} />
                  <div className="flex flex-col justify-between gap-2">
                    <div className="rounded-xl border bg-card px-3 py-3 text-center">
                      <span className="text-2xl font-bold tabular-nums">
                        {money(currentAmount)}
                      </span>
                    </div>
                    <Button
                      onClick={addCurrentPayment}
                      disabled={currentAmount <= 0}
                    >
                      <Check className="size-4" /> Agregar pago
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => addRemaining(method)}
                      disabled={remaining <= 0}
                    >
                      Exacto ({money(remaining)})
                    </Button>
                  </div>
                </div>

                {tipBlock}
                {denominationsBlock}
              </motion.div>
            )}
          </AnimatePresence>

          {pointOrder && (
            <div role="status" className="rounded-xl border border-info/40 bg-info/5 p-3">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-info/15 text-info-ink"><RadioTower className="size-5 animate-pulse" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Completa el pago en la terminal Point</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{pointStatus || "La terminal está recibiendo el cobro…"} · {money(pointOrder.amount)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">No cierres esta ventana. La venta se habilitará cuando Mercado Pago confirme la aprobación.</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={cancelPoint} disabled={pointBusy}>
                  <XCircle className="size-4" /> Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Info de crédito */}
          {method === "credit" && creditInfo && (
            <div className="rounded-xl border border-warning/40 bg-warning/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-warning-ink">
                <Landmark className="size-4" /> Crédito del cliente
              </p>
              <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Saldo actual:</span>
                  <span className="ml-1 font-bold">{money(creditInfo.balance)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Límite:</span>
                  <span className="ml-1 font-bold">{creditInfo.limit != null ? money(creditInfo.limit) : "Sin límite"}</span>
                </div>
              </div>
              {!creditInfo.allowed && (
                <p className="mt-1.5 text-xs text-destructive">
                  ⚠ {creditInfo.reason}
                </p>
              )}
            </div>
          )}

          {/* Puntos del cliente */}
          {t.customer && t.customer.points > 0 && (
            <div className="rounded-xl border border-warning/40 bg-warning/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-warning-ink">
                <PiggyBank className="size-4" /> Puntos del cliente ·{" "}
                {money(pointsToMoney(t.customer.points, loyalty.pointValue))}{" "}
                disponibles
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  value={pointsStr}
                  onChange={(e) =>
                    setPointsStr(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder={`${Math.floor(t.customer.points)} pts`}
                  inputMode="numeric"
                  aria-label="Puntos a canjear"
                  className="h-11"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 shrink-0"
                  onClick={() => applyPoints(Number(pointsStr))}
                >
                  Aplicar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 shrink-0"
                  onClick={() => applyPoints(maxPoints)}
                  disabled={maxPoints <= 0}
                >
                  Máximo
                </Button>
              </div>
              {t.pointsRedeemed > 0 && (
                <p className="mt-1.5 text-xs text-warning-ink">
                  Canjeando {t.pointsRedeemed} pts = -
                  {money(t.pointsRedeemedValue)}
                  <button
                    type="button"
                    className="ml-2 underline"
                    onClick={() => applyPoints(0)}
                  >
                    quitar
                  </button>
                </p>
              )}
            </div>
          )}

          {/* Referencia */}
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Referencia (opcional) — últimos 4, folio…"
            aria-label="Referencia"
            className="h-11"
          />
        </div>

        {/* ── Columna derecha: pagos realizados (siempre visible) ── */}
        <div className="md:sticky md:top-0 md:self-start">
          <div className="flex h-full flex-col rounded-2xl border bg-surface-sunken">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <ListChecks className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Pagos realizados</span>
              <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {entries.length}
              </span>
            </div>

            {/* Lista de pagos */}
            <div className="flex-1 space-y-1.5 overflow-y-auto p-3 md:max-h-72">
              <AnimatePresence initial={false}>
                {entries.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    Aún no agregas pagos.
                  </p>
                ) : (
                  entries.map((e, i) => (
                    <motion.div
                      key={`${e.method}-${i}`}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm"
                    >
                      {METHOD_ICONS[e.method]}
                      <span className="min-w-0 flex-1 truncate">
                        {PAYMENT_METHOD_LABELS[e.method]}
                        {e.reference && (
                          <span className="text-muted-foreground">
                            {" "}
                            · {e.reference}
                          </span>
                        )}
                      </span>
                      <span className="font-bold tabular-nums">
                        {money(e.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeEntry(i)}
                        className="flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* Resumen */}
            <div className="space-y-1 border-t px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pagado</span>
                <span className="font-semibold tabular-nums">
                  {money(paid)}
                </span>
              </div>
              {remaining > 0 ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Faltante</span>
                  <span className="font-semibold text-destructive tabular-nums">
                    {money(remaining)}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cambio</span>
                  <span className="font-semibold text-success-ink tabular-nums">
                    {money(change)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && <p className="text-center text-xs text-destructive">{error}</p>}
    </DialogComponent>
  )
}
