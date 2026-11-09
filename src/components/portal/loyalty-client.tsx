"use client"

import { useCallback, useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Star, TrendingUp, Gift, Clock, Sparkles, History, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { swalError, swalToast } from "@/lib/swal"
import { portalApi, type LoyaltyData } from "@/lib/portal/client"
import { money } from "@/lib/pos/money"
import { Skeleton } from "@/components/ui/skeleton"
import { PullToRefresh } from "@/components/shared/pull-to-refresh"
import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"
import { STAGGER } from "@/lib/animation-tokens"

const KIND_CONFIG: Record<string, { label: string; icon: typeof Star; color: string }> = {
  earn: { label: "Ganados", icon: TrendingUp, color: "text-success-ink bg-success/10" },
  redeem: { label: "Canjeados", icon: Gift, color: "text-warning-ink bg-warning/10" },
  adjust: { label: "Ajuste", icon: Star, color: "text-info-ink bg-info/10" },
  expire: { label: "Expirados", icon: Clock, color: "text-destructive bg-destructive/10" },
}

interface ProgramView {
  programId: string
  name: string
  kind: string
  credits: number
  visits: number
  visitsRequired: number | null
  membership: null | {
    status: "none" | "active" | "expired"
    startedAt: string | null
    expiresAt: string | null
    daysLeft: number | null
    creditsPerPeriod: number | null
    periodDays: number | null
    rollover: boolean
    price: number | null
    terms: string | null
    targetProductNames: string[]
  }
}
interface WarrantySale {
  saleId: string
  saleNumber: string
  createdAt: string
  offers: { ruleId: string; name: string; discountPercent: number; expiresAt: string; legend: string; claimStatus: string }[]
}

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })

export function LoyaltyClient() {
  const [data, setData] = useState<LoyaltyData | null>(null)
  const [programs, setPrograms] = useState<ProgramView[]>([])
  const [warranties, setWarranties] = useState<WarrantySale[]>([])

  const load = useCallback(async () => {
    const d = await portalApi.loyalty()
    setData(d)
    // Programas de fidelidad del negocio (tarjeta de visitas y paquetes): si falla, solo no se muestran.
    fetch("/api/portal/loyalty/programs", { cache: "no-store", credentials: "include" })
      .then((r) => r.json())
      .then((j) => setPrograms(j.ok ? j.programs : []))
      .catch(() => setPrograms([]))
    // Garantías de servicio vigentes (solo existen si el negocio las habilitó).
    fetch("/api/portal/warranties", { cache: "no-store", credentials: "include" })
      .then((r) => r.json())
      .then((j) => setWarranties(j.ok ? j.sales : []))
      .catch(() => setWarranties([]))
  }, [])

  const requestWarranty = async (saleId: string, ruleId: string) => {
    const res = await fetch("/api/portal/warranties", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ saleId, ruleId }) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.ok) return swalError("No se pudo pedir la garantía", json.error)
    swalToast("Garantía pedida: presenta tu ticket en el negocio")
    void load()
  }

  useEffect(() => {
    load().catch(() => undefined)
  }, [load])

  if (!data) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-8 w-32 rounded-xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <PullToRefresh onRefresh={load}>
      <div className="space-y-4 p-4">
        {programs.length > 0 && (
          <section aria-label="Mis programas" className="space-y-2">
            {programs.map((p) => (
              <article key={p.programId} className="space-y-3 rounded-2xl border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-semibold"><Gift className="size-4 shrink-0 text-primary" /> {p.name}</p>
                    {p.kind === "visit_card" && p.visitsRequired ? (
                      <>
                        <div className="mt-2 h-1.5 w-40 max-w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={p.visitsRequired} aria-valuenow={p.visits}>
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (p.visits / p.visitsRequired) * 100)}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground tabular">{p.visits} de {p.visitsRequired} visitas</p>
                      </>
                    ) : p.membership ? (
                      <span className={cn("mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", p.membership.status === "active" ? "bg-success/15 text-success-ink" : p.membership.status === "expired" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
                        {p.membership.status === "active" ? "Membresía vigente" : p.membership.status === "expired" ? "Membresía vencida" : "Sin membresía"}
                      </span>
                    ) : (
                      <p className="text-xs text-muted-foreground">Paquete prepagado</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-heading text-2xl font-semibold tabular">{p.credits}</p>
                    <p className="text-xs text-muted-foreground">{p.credits === 1 ? "crédito" : "créditos"}</p>
                  </div>
                </div>
                {p.membership && (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-muted/40 p-3 text-xs">
                    {p.membership.expiresAt && (
                      <div className="col-span-2">
                        <dt className="text-muted-foreground">{p.membership.status === "active" ? "Vence el" : "Venció el"}</dt>
                        <dd className="font-medium">{dateLabel(p.membership.expiresAt)}{p.membership.daysLeft !== null ? ` · faltan ${p.membership.daysLeft} ${p.membership.daysLeft === 1 ? "día" : "días"}` : ""}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-muted-foreground">Incluye por periodo</dt>
                      <dd className="font-medium">{p.membership.creditsPerPeriod} servicio(s) cada {p.membership.periodDays} días</dd>
                    </div>
                    {p.membership.price !== null && (
                      <div>
                        <dt className="text-muted-foreground">Cuota</dt>
                        <dd className="font-medium tabular">{money(p.membership.price)}</dd>
                      </div>
                    )}
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Aplica a</dt>
                      <dd className="font-medium">{p.membership.targetProductNames.length ? p.membership.targetProductNames.join(", ") : "Cualquier servicio"}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Servicios sin usar</dt>
                      <dd className="font-medium">{p.membership.rollover ? "Pasan al siguiente periodo si renuevas antes de vencer" : "No se acumulan al renovar"}</dd>
                    </div>
                    {p.membership.terms && (
                      <div className="col-span-2">
                        <dt className="text-muted-foreground">Condiciones</dt>
                        <dd className="whitespace-pre-line">{p.membership.terms}</dd>
                      </div>
                    )}
                    <p className="col-span-2 text-muted-foreground">Para dar de alta o renovar tu membresía, paga la cuota en el negocio.</p>
                  </dl>
                )}
              </article>
            ))}
          </section>
        )}

        {warranties.length > 0 && (
          <section aria-label="Mis garantías" className="space-y-2">
            <h2 className="flex items-center gap-2 text-base font-semibold"><ShieldCheck className="size-4" /> Garantías vigentes</h2>
            {warranties.flatMap((sale) => sale.offers.map((o) => (
              <article key={`${sale.saleId}:${o.ruleId}`} className="space-y-1.5 rounded-2xl border bg-card p-4">
                <p className="font-semibold">{o.name} · ticket {sale.saleNumber}</p>
                <p className="text-xs text-muted-foreground">{o.legend}</p>
                <p className="text-xs text-muted-foreground tabular">Vigente hasta {new Date(o.expiresAt).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                {o.claimStatus === "requested" ? (
                  <p className="text-xs font-medium text-success-ink">Ya la pediste: preséntate en el negocio con tu ticket.</p>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => void requestWarranty(sale.saleId, o.ruleId)}>Pedir esta garantía</Button>
                )}
              </article>
            )))}
          </section>
        )}

        {/* Points hero card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-e2"
        >
          <svg aria-hidden viewBox="0 0 200 200" className="absolute -top-16 -right-16 size-56 opacity-20">
            {[96, 76, 56, 36].map((r) => (
              <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeWidth="1.5" />
            ))}
          </svg>

          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="size-4 opacity-80" />
              <p className="text-sm font-medium opacity-85">Dinero electrónico disponible</p>
            </div>
            <motion.p
              className="font-heading text-4xl font-bold tracking-tight tabular"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            >
              {money(data.points * data.pointValue)}
            </motion.p>
            <p className="mt-1.5 text-sm opacity-75 tabular">
              {Math.floor(data.points)} pts · valor {money(data.pointValue)} por punto
            </p>
          </div>
        </motion.div>

        {/* Transactions header */}
        <div className="flex items-center gap-2">
          <History className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Historial</h2>
        </div>

        {/* Transactions */}
        <div className="space-y-2">
          {data.transactions.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Sin movimientos"
              description="Tus puntos aparecerán aquí cuando acumules o canjees."
            />
          ) : (
            <AnimatePresence>
              {data.transactions.map((t, idx) => {
                const config = KIND_CONFIG[t.kind] ?? KIND_CONFIG.adjust
                const Icon = config.icon
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * STAGGER.COMPACT }}
                  >
                      <div className="flex items-center gap-3 rounded-2xl border bg-card p-3.5">
                        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", config.color)}>
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{config.label}</p>
                          {t.note && <p className="text-xs text-muted-foreground truncate">{t.note}</p>}
                          <p className="text-xs text-muted-foreground/60">
                            {t.ticket != null && <span className="font-semibold text-foreground/70">#{t.ticket} · </span>}
                            {new Date(t.createdAt).toLocaleDateString("es-MX", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <span className={cn("text-sm font-bold tabular-nums", t.points >= 0 ? "text-success-ink" : "text-destructive")}>
                          {t.points >= 0 ? "+" : ""}{money(t.points)}
                        </span>
                      </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </PullToRefresh>
  )
}
