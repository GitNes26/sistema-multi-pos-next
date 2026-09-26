"use client"

import {
  AlertTriangle,
  Banknote,
  CircleCheck,
  CircleMinus,
  CirclePlus,
  FileText,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { DialogComponent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { money } from "@/lib/pos/money"
import { cn } from "@/lib/utils"

export interface CashCloseSummary {
  salesCount: number
  totalSales: number
  cashPayments: number
  changeGiven: number
  cashRefunds: number
  openingCash: number
  systemCash: number
  closingCash: number
  difference: number
  closedAt: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  summary: CashCloseSummary | null
}

export function CashDiscrepancyDialog({ open, onClose, summary }: Props) {
  if (!summary) return null

  const diff = summary.difference
  const absDiff = Math.abs(diff)
  const hasDiscrepancy = absDiff > 0.01
  const isShortage = diff < 0
  const isOverage = diff > 0

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      icon={
        hasDiscrepancy ? (
          <AlertTriangle className="size-5 text-warning-ink" />
        ) : (
          <CircleCheck className="size-5 text-success-ink" />
        )
      }
      title="Corte de caja"
      description={
        hasDiscrepancy
          ? `Discrepancia de ${money(absDiff)} ${isShortage ? "faltante" : "sobrante"}`
          : "Cuadre correcto — sin discrepancias"
      }
      className="sm:max-w-md"
      bodyClassName="space-y-4"
      footerClassName="gap-2"
      footer={
        <Button className="flex-1" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      {/* Discrepancy Hero */}
      <div
        className={cn(
          "flex items-center gap-4 rounded-xl border-2 p-4",
          hasDiscrepancy
            ? isShortage
              ? "border-destructive/30 bg-destructive/10"
              : "border-warning/30 bg-warning/10"
            : "border-success/30 bg-success/10"
        )}
      >
        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-full",
            hasDiscrepancy
              ? isShortage
                ? "bg-destructive/10 text-destructive"
                : "bg-warning/10 text-warning-ink"
              : "bg-success/10 text-success-ink"
          )}
        >
          {hasDiscrepancy ? (
            isShortage ? (
              <TrendingDown className="size-6" />
            ) : (
              <TrendingUp className="size-6" />
            )
          ) : (
            <CircleCheck className="size-6" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-2xl font-black tabular-nums",
              hasDiscrepancy
                ? isShortage
                  ? "text-destructive"
                  : "text-warning-ink"
                : "text-success-ink"
            )}
          >
            {hasDiscrepancy ? (isShortage ? "-" : "+") : ""}{money(absDiff)}
          </p>
          <p className="text-xs text-muted-foreground">
            {hasDiscrepancy
              ? isShortage
                ? "Faltante — el efectivo contado es menor al esperado"
                : "Sobrante — el efectivo contado es mayor al esperado"
              : "El efectivo contado coincide con el sistema"}
          </p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-2 rounded-xl border bg-card p-3 text-sm">
        <Row
          icon={<Banknote className="size-3.5" />}
          label="Fondo de apertura"
          value={summary.openingCash}
        />
        <Row
          icon={<Receipt className="size-3.5" />}
          label={`Ventas en efectivo (${summary.salesCount} ventas)`}
          value={summary.cashPayments}
          className="text-success-ink"
        />
        <Row
          icon={<TrendingDown className="size-3.5" />}
          label="Cambio entregado"
          value={-summary.changeGiven}
          className="text-destructive"
        />
        <Row
          icon={<CircleMinus className="size-3.5" />}
          label="Reembolsos en efectivo"
          value={-summary.cashRefunds}
          className="text-destructive"
        />
        <div className="border-t pt-2">
          <Row
            icon={<FileText className="size-3.5" />}
            label="Efectivo esperado (sistema)"
            value={summary.systemCash}
            bold
          />
        </div>
        <div className="border-t pt-2">
          <Row
            icon={<Banknote className="size-3.5" />}
            label="Efectivo contado"
            value={summary.closingCash}
            bold
          />
        </div>
      </div>

      {summary.closedAt && (
        <p className="text-center text-xs text-muted-foreground">
          Cerrado el {new Date(summary.closedAt).toLocaleString("es-MX")}
        </p>
      )}
    </DialogComponent>
  )
}

function Row({
  icon,
  label,
  value,
  bold,
  className,
}: {
  icon: React.ReactNode
  label: string
  value: number
  bold?: boolean
  className?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums shrink-0",
          bold ? "font-bold" : "font-medium",
          className
        )}
      >
        {money(value)}
      </span>
    </div>
  )
}
