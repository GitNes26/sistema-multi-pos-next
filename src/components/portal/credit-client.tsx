"use client"

import { useCallback, useEffect, useState } from "react"
import { Landmark, ArrowDownCircle, ArrowUpCircle, Clock, AlertTriangle, CreditCard, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { InputGroupField } from "@/components/base/input-group-field"
import { AnimatedNumber } from "@/components/base/animated-number"
import { Spinner } from "@/components/base/spinner"
import { EmptyState } from "@/components/shared/empty-state"
import { money } from "@/lib/pos/money"
import { playSound } from "@/lib/sounds"
import { cn } from "@/lib/utils"

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

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/credit", { credentials: "include" })
      const data = await res.json()
      if (data.ok) {
        setCredit(data.credit)
        setTransactions(data.transactions ?? [])
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
        playSound("sale-complete")
        setPaymentAmount("")
        load()
      } else {
        playSound("error")
        alert(data.error ?? "Error al procesar el pago")
      }
    } catch {
      playSound("error")
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
    <div className="space-y-4 p-4">
      {/* Credit Summary Card */}
      <div className="rounded-2xl border bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Landmark className="size-5 text-amber-600" />
          <h2 className="text-lg font-bold">Mi Crédito</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Saldo pendiente</p>
            <AnimatedNumber
              value={credit?.currentBalance ?? 0}
              format={money}
              className={cn("text-2xl font-black tabular-nums", hasDebt ? "text-red-600" : "text-emerald-600")}
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
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">
            <AlertTriangle className="size-4" />
            Tu cuenta de crédito está suspendida. Contacta soporte.
          </div>
        )}
      </div>

      {/* Tabs — reutiliza componente Tabs */}
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
            <div className="rounded-xl border p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <CreditCard className="size-4" /> Realizar abono
              </h3>
              <div className="flex items-center gap-2">
                <InputGroupField
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
                  onClick={makePayment}
                  disabled={paying || !paymentAmount || parseFloat(paymentAmount) <= 0}
                  className="shrink-0"
                >
                  {paying ? "Procesando…" : "Pagar"}
                </Button>
              </div>
              <div className="flex gap-2">
                {[100, 200, 500].map((preset) => (
                  <Button
                    key={preset}
                    variant="outline"
                    size="sm"
                    onClick={() => setPaymentAmount(String(preset))}
                  >
                    ${preset}
                  </Button>
                ))}
                {credit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaymentAmount(String(credit.currentBalance))}
                  >
                    Todo
                  </Button>
                )}
              </div>
            </div>
          )}

          {!hasDebt && credit && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 text-center">
              <p className="text-sm font-semibold text-emerald-600">✅ No tienes deuda pendiente</p>
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
                    tx.type === "charge" ? "bg-red-500/10 text-red-600" : "bg-emerald-500/10 text-emerald-600"
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
                      tx.type === "charge" ? "text-red-600" : "text-emerald-600"
                    )}>
                      {tx.type === "charge" ? "+" : "-"}{money(tx.amount)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Saldo: {money(tx.balanceAfter)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}


