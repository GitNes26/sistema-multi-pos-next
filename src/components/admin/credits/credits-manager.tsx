"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Landmark,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  DollarSign,
  Eye,
  Users,
  Clock,
  Settings,
  BadgeCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { DialogComponent } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { DataTable } from "@/components/base/data-table"
import { InputGroupField } from "@/components/base/input-group-field"
import { AnimatedNumber } from "@/components/base/animated-number"
import { EmptyState } from "@/components/shared/empty-state"
import { TooltipButton } from "@/components/shared/tooltip-button"
import { Spinner } from "@/components/base/spinner"
import { money } from "@/lib/pos/money"
import { playSound } from "@/lib/sounds"
import { swalToast, swalError } from "@/lib/swal"
import { cn } from "@/lib/utils"

interface CreditAccount {
  id: string
  customerId: string
  customerName: string
  customerPhone: string | null
  customerCode: string | null
  organizationId?: string
  organizationName?: string
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
  referenceType: string | null
  referenceId: string | null
  dueDate: string | null
  paidAt: string | null
  createdAt: string
}

interface CreditsManagerProps {
  isSuperadmin: boolean
}

const TX_TYPE_LABELS: Record<string, string> = {
  charge: "Cargo",
  payment: "Abono",
  adjustment: "Ajuste",
  writeoff: "Descargo",
}

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  suspended: "Suspendida",
  settled: "Liquidada",
}

export function CreditsManager({ isSuperadmin }: CreditsManagerProps) {
  const [credits, setCredits] = useState<CreditAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CreditAccount | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [txLoading, setTxLoading] = useState(false)
  const [actionOpen, setActionOpen] = useState(false)
  const [actionType, setActionType] = useState<"charge" | "payment" | "adjustment" | "limit">("payment")
  const [actionAmount, setActionAmount] = useState("")
  const [actionDesc, setActionDesc] = useState("")
  const [actionSaving, setActionSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const url = isSuperadmin ? "/api/customer-credit?allOrgs=true" : "/api/customer-credit"
      const res = await fetch(url, { credentials: "include" })
      const data = await res.json()
      if (data.ok) setCredits(data.credits ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [isSuperadmin])

  useEffect(() => { load() }, [load])

  // Stats
  const totalDebt = credits.reduce((s, c) => s + c.currentBalance, 0)
  const totalCustomers = credits.length
  const overdueCount = credits.filter((c) => c.status === "overdue").length

  // DataTable columns
  const columns = useMemo<ColumnDef<CreditAccount>[]>(() => {
    const cols: ColumnDef<CreditAccount>[] = [
      {
        id: "customerName",
        header: "Cliente",
        accessorKey: "customerName",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.customerName}</div>
            {row.original.customerPhone && (
              <div className="text-xs text-muted-foreground">{row.original.customerPhone}</div>
            )}
          </div>
        ),
      },
      {
        id: "customerCode",
        header: "Código",
        accessorKey: "customerCode",
        cell: ({ row }) => (
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            {row.original.customerCode ?? "—"}
          </code>
        ),
      },
      {
        id: "creditLimit",
        header: "Límite",
        accessorKey: "creditLimit",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.creditLimit != null ? money(row.original.creditLimit) : <span className="text-muted-foreground">Sin límite</span>}
          </span>
        ),
      },
      {
        id: "currentBalance",
        header: "Deuda",
        accessorKey: "currentBalance",
        cell: ({ row }) => (
          <span className="tabular-nums font-bold text-red-600">{money(row.original.currentBalance)}</span>
        ),
      },
      {
        id: "status",
        header: "Estado",
        accessorKey: "status",
        cell: ({ row }) => (
          <Badge variant={
            row.original.status === "active" ? "default" :
            row.original.status === "suspended" ? "destructive" : "secondary"
          }>
            {STATUS_LABELS[row.original.status] ?? row.original.status}
          </Badge>
        ),
      },
    ]

    if (isSuperadmin) {
      cols.splice(1, 0, {
        id: "organizationName",
        header: "Empresa",
        accessorKey: "organizationName",
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">{row.original.organizationName}</Badge>
        ),
      })
    }

    return cols
  }, [isSuperadmin])

  const openDetail = async (credit: CreditAccount) => {
    setSelected(credit)
    setTxLoading(true)
    try {
      const res = await fetch(`/api/customer-credit?customerId=${credit.customerId}`, { credentials: "include" })
      const data = await res.json()
      if (data.ok) setTransactions(data.transactions ?? [])
    } catch {
      // silent
    } finally {
      setTxLoading(false)
    }
  }

  const openAction = (type: "charge" | "payment" | "adjustment" | "limit") => {
    setActionType(type)
    setActionAmount("")
    setActionDesc("")
    setActionOpen(true)
  }

  const executeAction = async () => {
    if (!selected) return
    setActionSaving(true)
    try {
      if (actionType === "limit") {
        const res = await fetch("/api/customer-credit", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            customerId: selected.customerId,
            creditLimit: actionAmount !== "" ? Number(actionAmount) : null,
          }),
        })
        const data = await res.json()
        if (!data.ok) throw new Error(data.error)
        swalToast("Límite actualizado")
      } else {
        const res = await fetch("/api/customer-credit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            customerId: selected.customerId,
            type: actionType,
            amount: Number(actionAmount),
            description: actionDesc || undefined,
          }),
        })
        const data = await res.json()
        if (!data.ok) throw new Error(data.error)
        playSound("sale-complete")
        swalToast(actionType === "payment" ? "Abono registrado" : actionType === "charge" ? "Cargo registrado" : "Ajuste registrado")
      }
      setActionOpen(false)
      await load()
      // Refresh detail
      if (selected) {
        const res = await fetch(`/api/customer-credit?customerId=${selected.customerId}`, { credentials: "include" })
        const data = await res.json()
        if (data.ok) setTransactions(data.transactions ?? [])
        const refreshed = await fetch(isSuperadmin ? "/api/customer-credit?allOrgs=true" : "/api/customer-credit", { credentials: "include" })
        const rd = await refreshed.json()
        if (rd.ok) {
          setCredits(rd.credits ?? [])
          const newSel = (rd.credits ?? []).find((c: CreditAccount) => c.customerId === selected.customerId)
          if (newSel) setSelected(newSel)
        }
      }
    } catch (err) {
      playSound("error")
      swalError("Error", err instanceof Error ? err.message : undefined)
    } finally {
      setActionSaving(false)
    }
  }

  // Mobile card renderer for DataTable
  const renderCard = useCallback((row: CreditAccount) => (
    <div className="space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium">{row.customerName}</p>
          <p className="text-xs text-muted-foreground">{row.customerPhone ?? row.customerCode ?? "—"}</p>
        </div>
        <Badge variant={
          row.status === "active" ? "default" :
          row.status === "suspended" ? "destructive" : "secondary"
        }>
          {STATUS_LABELS[row.status] ?? row.status}
        </Badge>
      </div>
      {isSuperadmin && row.organizationName && (
        <Badge variant="outline" className="text-xs">{row.organizationName}</Badge>
      )}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Deuda</span>
        <span className="font-bold tabular-nums text-red-600">{money(row.currentBalance)}</span>
      </div>
      {row.creditLimit != null && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Límite</span>
          <span className="tabular-nums">{money(row.creditLimit)}</span>
        </div>
      )}
    </div>
  ), [isSuperadmin])

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10">
              <DollarSign className="size-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cartera total</p>
              <AnimatedNumber value={totalDebt} format={money} className="text-lg font-black tabular-nums" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10">
              <Users className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Clientes con deuda</p>
              <p className="text-lg font-black tabular-nums">{totalCustomers}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-red-500/10">
              <AlertTriangle className="size-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vencidos</p>
              <p className="text-lg font-black tabular-nums">{overdueCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <Landmark className="size-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Promedio deuda</p>
              <p className="text-lg font-black tabular-nums">
                {totalCustomers > 0 ? money(totalDebt / totalCustomers) : "$0"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DataTable — reutiliza search, paginación, sort, mobile cards */}
      <DataTable
        columns={columns}
        data={credits}
        loading={loading}
        searchable
        searchPlaceholder="Buscar por nombre, código, teléfono…"
        showPagination
        showColumnVisibility={false}
        onRowClick={openDetail}
        renderCard={renderCard}
        emptyMessage="No hay clientes con deuda pendiente"
        onRefresh={load}
        refreshing={loading}
        toolbarSlot={
          <TooltipButton
            label="Registrar nuevo movimiento de crédito"
            variant="default"
            size="sm"
            className="h-8"
            onClick={() => { setSelected(null); openAction("payment") }}
          >
            <BadgeCheck className="size-4" /> Nuevo movimiento
          </TooltipButton>
        }
      />

      {/* Detail Dialog */}
      <DialogComponent
        open={Boolean(selected)}
        onOpenChange={(o) => { if (!o) { setSelected(null); setTransactions([]) } }}
        title={selected ? selected.customerName : "Detalle de crédito"}
        description={selected ? `Deuda: ${money(selected.currentBalance)}` : ""}
        className="max-w-[90vw]"
        size="3xl"
      >
        {selected && (
          <div className="space-y-4">
            {/* Balance summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border bg-red-500/5 p-3 text-center">
                <p className="text-xs text-muted-foreground">Deuda actual</p>
                <AnimatedNumber value={selected.currentBalance} format={money} className="text-xl font-black tabular-nums text-red-600" />
              </div>
              <div className="rounded-xl border bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">Límite</p>
                <p className="text-xl font-black tabular-nums">
                  {selected.creditLimit != null ? money(selected.creditLimit) : "Sin límite"}
                </p>
              </div>
              <div className="rounded-xl border bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">Disponible</p>
                <p className="text-xl font-black tabular-nums text-emerald-600">
                  {selected.creditLimit != null ? money(Math.max(0, selected.creditLimit - selected.currentBalance)) : "∞"}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => openAction("payment")} className="bg-emerald-600 hover:bg-emerald-700">
                <ArrowUpCircle className="size-4" /> Registrar abono
              </Button>
              <Button size="sm" variant="outline" onClick={() => openAction("charge")}>
                <ArrowDownCircle className="size-4" /> Registrar cargo
              </Button>
              <Button size="sm" variant="outline" onClick={() => openAction("adjustment")}>
                <DollarSign className="size-4" /> Ajuste
              </Button>
              <Button size="sm" variant="outline" onClick={() => openAction("limit")}>
                <Settings className="size-4" /> Cambiar límite
              </Button>
            </div>

            {/* Transactions — reutiliza Tabs */}
            <Tabs defaultValue="history">
              <TabsList>
                <TabsTrigger value="history">
                  <Clock className="size-3.5 mr-1" /> Historial ({transactions.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="history">
                {txLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Spinner className="size-5" />
                  </div>
                ) : transactions.length === 0 ? (
                  <EmptyState icon={Clock} title="Sin transacciones" description="No hay movimientos de crédito registrados." />
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-1.5">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm">
                        <div className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full",
                          tx.type === "charge" ? "bg-red-500/10 text-red-600" :
                          tx.type === "payment" ? "bg-emerald-500/10 text-emerald-600" :
                          "bg-blue-500/10 text-blue-600"
                        )}>
                          {tx.type === "charge" ? <ArrowDownCircle className="size-4" /> :
                           tx.type === "payment" ? <ArrowUpCircle className="size-4" /> :
                           <DollarSign className="size-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">
                            {TX_TYPE_LABELS[tx.type] ?? tx.type}
                            {tx.description && <span className="text-muted-foreground"> · {tx.description}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.createdAt).toLocaleString("es-MX")}
                            {tx.dueDate && <> · Vence: {new Date(tx.dueDate).toLocaleDateString("es-MX")}</>}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn(
                            "font-bold tabular-nums",
                            tx.type === "charge" ? "text-red-600" : "text-emerald-600"
                          )}>
                            {tx.type === "charge" ? "+" : "-"}{money(tx.amount)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Saldo: {money(tx.balanceAfter)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogComponent>

      {/* Action Dialog */}
      <DialogComponent
        open={actionOpen}
        onOpenChange={(o) => setActionOpen(o)}
        title={
          actionType === "payment" ? "Registrar abono" :
          actionType === "charge" ? "Registrar cargo" :
          actionType === "limit" ? "Cambiar límite de crédito" :
          "Ajuste de crédito"
        }
        description={selected ? `Cliente: ${selected.customerName}` : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setActionOpen(false)} disabled={actionSaving}>Cancelar</Button>
            <Button onClick={executeAction} disabled={actionSaving || !actionAmount}>
              {actionSaving ? <Spinner className="size-4" /> : null}
              {actionSaving ? "Guardando…" : "Confirmar"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <InputGroupField
            label={actionType === "limit" ? "Nuevo límite (vacío = sin límite)" : "Monto"}
            type="number"
            min={0}
            step="0.01"
            placeholder="0"
            leftIcon={<DollarSign className="size-4" />}
            value={actionAmount}
            onChange={(e) => setActionAmount(e.target.value)}
          />
          {actionType !== "limit" && (
            <InputGroupField
              label="Descripción (opcional)"
              placeholder="Motivo del movimiento"
              value={actionDesc}
              onChange={(e) => setActionDesc(e.target.value)}
            />
          )}
          {selected && actionType !== "limit" && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p>Saldo actual: <span className="font-bold">{money(selected.currentBalance)}</span></p>
              {actionType === "payment" && (
                <p className="text-emerald-600">Nuevo saldo: <span className="font-bold">{money(Math.max(0, selected.currentBalance - (Number(actionAmount) || 0)))}</span></p>
              )}
              {actionType === "charge" && (
                <p className="text-red-600">Nuevo saldo: <span className="font-bold">{money(selected.currentBalance + (Number(actionAmount) || 0))}</span></p>
              )}
            </div>
          )}
        </div>
      </DialogComponent>
    </>
  )
}
