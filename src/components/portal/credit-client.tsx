"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Landmark, ArrowDownCircle, ArrowUpCircle, Clock, AlertTriangle, CreditCard, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { InputGroupField } from "@/components/base/input-group-field"
import { AnimatedNumber } from "@/components/base/animated-number"
import { Spinner } from "@/components/base/spinner"
import { EmptyState } from "@/components/shared/empty-state"
import { PullToRefresh } from "@/components/shared/pull-to-refresh"
import { money } from "@/lib/pos/money"
import { playSound } from "@/lib/sounds"
import { cn } from "@/lib/utils"
import { STAGGER_FADE_UP } from "@/lib/animation-tokens"

interface CreditInfo {
  creditLimit: number | null
  currentBalance: number
  status: string
}

interface Transaction {
  id: string
  type: string
  amount: number
  balanceAfter: number
  description: string | null
  dueDate: string | null
  paidAt: string | null
  createdAt: string
}

const TX_LABELS: Record<string, string> = {
  charge: "Compra a crédito",
  payment: "Abono",
  adjustment: "Ajuste",
  writeoff: "Descargo",
}

export function CreditClient() {
  const [credit, setCredit] = useState<CreditInfo | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paying, setPaying] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  const [activePaymentPending, setActivePaymentPending] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/credit", { credentials: "include" })
      const data = await res.json()
      if (data.ok) {
        setCredit(data.credit)
        setTransactions(data.transactions ?? [])
        const latestPayment = data.recentPayments?.[0]
        setPaymentStatus(latestPayment?.status ?? null)
        setActivePaymentPending(latestPayment?.status === "pending" && Date.now() - new Date(latestPayment.createdAt).getTime() < 30 * 60_000)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const makePayment = async () => {
    const amount = parseFloat(paymentAmount.replace(",", "."))
    if (!amount || amount <= 0) return
    setPaymentError(null)
    setPaying(true)
    try {
      const res = await fetch("/api/portal/credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount }),
      })
      const data = await res.json()
      if (data.ok) {
        window.location.assign(data.url)
      } else {
        playSound("error")
        setPaymentError(data.error ?? "No se pudo preparar el pago")
      }
    } catch {
      playSound("error")
      setPaymentError("No se pudo conectar con la pasarela. Intenta de nuevo.")
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="size-6" />
      </div>
    )
  }

  const hasDebt = credit && credit.currentBalance > 0

  return (
    <PullToRefresh onRefresh={load}>
      <motion.div
        className="space-y-4 p-4"
        variants={STAGGER_FADE_UP.container}
        initial="hidden"
        animate="show"
      >
        {/* Credit Summary Card */}
        <motion.div variants={STAGGER_FADE_UP.item} className="rounded-2xl border border-warning/30 bg-warning/10 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Landmark className="size-5 text-warning-ink" />
          <h2 className="text-lg font-bold">Mi Crédito</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Saldo pendiente</p>
            <AnimatedNumber
              value={credit?.currentBalance ?? 0}
              format={money}
              className={cn("text-2xl font-black tabular-nums", hasDebt ? "text-destructive" : "text-success-ink")}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Límite de crédito</p>
            <p className="text-2xl font-black tabular-nums">
              {credit?.creditLimit != null ? money(credit.creditLimit) : "Sin límite"}
            </p>
          </div>
        </div>

        {credit?.status === "suspended" && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="size-4" />
            Tu cuenta de crédito está suspendida. Contacta soporte.
          </div>
        )}
      </motion.div>

      {/* Tabs — reutiliza componente Tabs */}
      <motion.div variants={STAGGER_FADE_UP.item}>
      <Tabs defaultValue="summary">
        <TabsList className="w-full">
          <TabsTrigger value="summary" className="flex-1">
            <Landmark className="size-3.5 mr-1" /> Resumen
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1">
            <Clock className="size-3.5 mr-1" /> Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          {/* Payment section */}
          {hasDebt && (
            <form onSubmit={(event) => { event.preventDefault(); void makePayment() }} className="rounded-xl border p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <CreditCard className="size-4" /> Realizar abono
              </h3>
              {activePaymentPending && <p role="status" className="text-xs text-warning-ink">Hay un abono en proceso. El saldo cambiará cuando se confirme el pago. Si no recibes confirmación, podrás intentar de nuevo en 30 minutos.</p>}
              {paymentStatus === "paid_review" && <p role="status" className="text-xs text-warning-ink">Recibimos un pago que requiere conciliación con tu saldo. El comercio lo revisará.</p>}
              {paymentError && <p role="alert" className="text-xs text-destructive">{paymentError}</p>}
              <div className="flex items-center gap-2">
                <InputGroupField
                  id="credit-payment-amount"
                  label="Monto del abono"
                  required
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Monto a pagar"
                  leftIcon={<DollarSign className="size-4" />}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  disabled={paying || activePaymentPending || paymentStatus === "paid_review" || !paymentAmount || parseFloat(paymentAmount) <= 0}
                  className="shrink-0"
                >
                  {paying ? "Preparando pago…" : "Continuar al pago"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">El abono se reflejará cuando la pasarela confirme el pago. Volver a esta página no confirma el cargo por sí solo.</p>
              <div className="flex gap-2">
                {[100, 200, 500].map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPaymentAmount(String(preset))}
                  >
                    ${preset}
                  </Button>
                ))}
                {credit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPaymentAmount(String(credit.currentBalance))}
                  >
                    Todo
                  </Button>
                )}
              </div>
            </form>
          )}

          {!hasDebt && credit && (
            <div className="rounded-xl border border-success/40 bg-success/5 p-4 text-center">
              <p className="text-sm font-semibold text-success-ink">✅ No tienes deuda pendiente</p>
            </div>
          )}

          {!credit && (
            <EmptyState
              icon={Landmark}
              title="Sin cuenta de crédito"
              description="Aún no tienes una cuenta de crédito. Consulta en tienda para solicitar una."
            />
          )}
        </TabsContent>

        <TabsContent value="history">
          {transactions.length === 0 ? (
            <EmptyState icon={Clock} title="Sin transacciones" description="No hay movimientos de crédito registrados." />
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 rounded-xl border bg-card px-3 py-3"
                >
                  <div className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full",
                    tx.type === "charge" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success-ink"
                  )}>
                    {tx.type === "charge" ? (
                      <ArrowDownCircle className="size-5" />
                    ) : (
                      <ArrowUpCircle className="size-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {TX_LABELS[tx.type] ?? tx.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tx.description ?? new Date(tx.createdAt).toLocaleDateString("es-MX")}
                      {tx.dueDate && (
                        <> · Vence: {new Date(tx.dueDate).toLocaleDateString("es-MX")}</>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn(
                      "text-sm font-bold tabular-nums",
                      tx.type === "charge" ? "text-destructive" : "text-success-ink"
                    )}>
                      {tx.type === "charge" ? "+" : "-"}{money(tx.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Saldo: {money(tx.balanceAfter)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      </motion.div>
      </motion.div>
    </PullToRefresh>
  )
}
