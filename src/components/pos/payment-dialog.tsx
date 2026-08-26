"use client"

import { useEffect, useState } from "react"
import type { $Enums } from "@prisma/client"
import { AnimatePresence, motion } from "framer-motion"
import {
  Banknote,
  BadgeCheck,
  Check,
  CreditCard,
  MoreHorizontal,
  PiggyBank,
  ReceiptText,
  Trash2,
  Wallet,
  Zap,
  ListChecks,
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
}

const METHODS: $Enums.PaymentMethod[] = ["cash", "card", "wallet", "other"]

const METHOD_ICONS: Partial<Record<$Enums.PaymentMethod, React.ReactNode>> = {
  cash: <Banknote className="size-5" />,
  card: <CreditCard className="size-5" />,
  wallet: <Wallet className="size-5" />,
  other: <MoreHorizontal className="size-5" />,
}

const METHOD_COLORS: Record<string, string> = {
  cash: "bg-emerald-600 hover:bg-emerald-700 text-white",
  card: "bg-blue-600 hover:bg-blue-700 text-white",
  wallet: "bg-violet-600 hover:bg-violet-700 text-white",
  other: "bg-muted hover:bg-muted/80",
}

export function PaymentDialog({
  open,
  onClose,
  onSuccess,
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

  const maxPoints = t.customer
    ? Math.max(
        0,
        Math.min(
          Math.floor(t.customer.points),
          Math.ceil(moneyToPoints(t.total, loyalty.pointValue))
        )
      )
    : 0

  const paid = round2(entries.reduce((s, e) => s + e.amount, 0))
  const remaining = round2(Math.max(0, t.payable - paid))
  const change = round2(Math.max(0, paid - t.payable))
  const progress = t.payable > 0 ? Math.min(100, (paid / t.payable) * 100) : 0
  const currentAmount = parseFloat(cashStr.replace(",", ".")) || 0

  useEffect(() => {
    if (open) {
      setEntries([])
      setCashStr("")
      setPointsStr("")
      setReference("")
      setError("")
      setTab("quick")
    }
  }, [open])

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

  const addPayment = (m: $Enums.PaymentMethod, amount: number) => {
    if (amount <= 0) return
    setEntries((prev) => [
      ...prev,
      {
        method: m,
        amount: round2(amount),
        reference: reference.trim() || undefined,
      },
    ])
    setCashStr("")
    setReference("")
  }

  const addCurrentPayment = () => addPayment(method, currentAmount)
  const addRemaining = (m: $Enums.PaymentMethod = method) =>
    addPayment(m, remaining)
  const removeEntry = (i: number) =>
    setEntries((prev) => prev.filter((_, idx) => idx !== i))

  const complete = async () => {
    if (paid - t.payable < -0.01) {
      setError("Falta por cubrir el total")
      return
    }
    setLoading(true)
    setError("")
    try {
      const payload = buildSalePayload(t, entries, change)
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
            className="rounded-xl border bg-background py-2.5 text-sm font-bold tabular-nums transition hover:bg-muted active:scale-[0.97]"
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
        if (!o && !loading) {
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
          Restante: {money(t.payable)}
        </>
      }
      size="3xl"
      bodyClassName="space-y-3"
      footer={
        <Button
          size="lg"
          className="h-14 w-full text-base font-bold"
          disabled={loading || paid - t.payable < -0.01}
          onClick={complete}
        >
          <BadgeCheck className="size-5" />
          {loading ? "Registrando…" : `Completar venta · ${money(t.payable)}`}
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        {/* ── Columna izquierda: acción de pago ───────────────────── */}
        <div className="space-y-3 md:col-span-2">
          {/* Total + progress */}
          <div className="rounded-2xl border bg-muted/30 p-4">
            <div className="flex items-end justify-between">
              <span className="text-sm text-muted-foreground">
                Total a cobrar
              </span>
              <AnimatedNumber
                value={t.payable}
                format={money}
                className="text-3xl font-black tabular-nums"
              />
            </div>
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
                <span className="font-semibold text-emerald-600 tabular-nums">
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
                "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                tab === "quick" ? "bg-card shadow-sm" : "text-muted-foreground"
              )}
            >
              <Zap className="size-4" /> Pago rápido
            </button>
            <button
              type="button"
              onClick={() => setTab("custom")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                tab === "custom" ? "bg-card shadow-sm" : "text-muted-foreground"
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
                        "flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition active:scale-[0.97]",
                        METHOD_COLORS.cash
                      )}
                    >
                      <Banknote className="size-5" />
                      Efectivo · {money(remaining)}
                    </button>
                    <button
                      type="button"
                      onClick={() => addRemaining("card")}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition active:scale-[0.97]",
                        METHOD_COLORS.card
                      )}
                    >
                      <CreditCard className="size-5" />
                      Tarjeta · {money(remaining)}
                    </button>
                  </div>
                )}

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
                <div className="grid grid-cols-4 gap-1.5">
                  {METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[10px] font-medium transition",
                        // method === m ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                        METHOD_COLORS[m]
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

                {denominationsBlock}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Puntos del cliente */}
          {t.customer && t.customer.points > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
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
                  className="h-9"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0"
                  onClick={() => applyPoints(Number(pointsStr))}
                >
                  Aplicar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0"
                  onClick={() => applyPoints(maxPoints)}
                  disabled={maxPoints <= 0}
                >
                  Máximo
                </Button>
              </div>
              {t.pointsRedeemed > 0 && (
                <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
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
            className="h-9"
          />
        </div>

        {/* ── Columna derecha: pagos realizados (siempre visible) ── */}
        <div className="md:sticky md:top-0 md:self-start">
          <div className="flex h-full flex-col rounded-2xl border bg-muted/30">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <ListChecks className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Pagos realizados</span>
              <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
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
                        className="text-muted-foreground hover:text-destructive"
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
                  <span className="font-semibold text-emerald-600 tabular-nums">
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
