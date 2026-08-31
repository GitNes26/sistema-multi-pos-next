"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  ChevronRight,
  Megaphone,
  Sparkles,
  Package,
  ShoppingBag,
  ArrowRight,
  Calendar,
} from "lucide-react"
import { portalApi } from "@/lib/portal/client"
import type { PortalHomeData } from "@/lib/portal/server"
import { money, qty } from "@/lib/pos/money"
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  type OrderStatusKey,
} from "@/lib/orders/client"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { TapScale } from "@/components/shared/tap-scale"
import { PermissionSlider } from "@/components/shared/permission-slider"
import { usePortalPermissions, type PortalPermissionType } from "@/hooks/use-portal-permissions"
import { cn } from "@/lib/utils"
import { DetailSheet, type DetailItem } from "@/components/portal/detail-sheet"

const PUB_TYPE_LABELS: Record<string, string> = {
  product_new: "Nuevo",
  promotion: "Promoción",
  notice: "Aviso",
}

const PUB_TYPE_COLORS: Record<string, string> = {
  product_new: "bg-emerald-500 text-white",
  promotion: "bg-amber-500 text-white",
  notice: "bg-sky-500 text-white",
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
}

export function HomeClient() {
  const [data, setData] = useState<PortalHomeData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { needsPermissions, pendingTypes, markTypeRequested } = usePortalPermissions()
  const [permQueue, setPermQueue] = useState<PortalPermissionType[]>([])
  const [activePerm, setActivePerm] = useState<PortalPermissionType | null>(null)
  const [detailItem, setDetailItem] = useState<DetailItem | null>(null)

  useEffect(() => {
    let active = true
    portalApi
      .home()
      .then((d) => active && setData(d))
      .catch(
        (e) => active && setError(e instanceof Error ? e.message : "Error")
      )
    return () => {
      active = false
    }
  }, [])

  // Post-login: show permission sliders on first visit (solo pendientes)
  useEffect(() => {
    if (!needsPermissions || permQueue.length > 0 || activePerm) return
    setPermQueue([...pendingTypes])
  }, [needsPermissions, pendingTypes, permQueue.length, activePerm])

  useEffect(() => {
    if (permQueue.length > 0 && !activePerm) {
      setActivePerm(permQueue[0])
    }
  }, [permQueue, activePerm])

  const handlePermDone = (type: PortalPermissionType) => {
    markTypeRequested(type)
    setActivePerm(null)
    setPermQueue((prev) => prev.slice(1))
  }

  if (error) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">{error}</p>
    )
  }
  if (!data) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    )
  }

  const activeOrders = data.activeOrders.filter((o) => o.status !== "cancelled")
  const banners = data.publications

  return (
    <motion.div
      className="space-y-5 p-4"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Puntos hero */}
      <motion.div variants={item}>
        <Link href="/portal/loyalty" className="block">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 p-5 text-primary-foreground shadow-lg shadow-primary/20">
            <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/10" />
            <div className="absolute -bottom-6 -left-6 size-24 rounded-full bg-white/5" />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-xs font-medium opacity-80">
                  Puntos acumulados
                </p>
                <motion.p
                  className="mt-1 text-3xl font-extrabold tracking-tight"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  {qty(data.points)}
                  <small className="text-xs">pts</small>
                </motion.p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-xl bg-white/15">
                <Sparkles className="size-5" />
              </div>
            </div>
          </div>
        </Link>
      </motion.div>

      {/* Pedidos activos */}
      {activeOrders.length > 0 && (
        <motion.section variants={item}>
          <h2 className="mb-2 text-sm font-semibold">Pedidos activos</h2>
          <div className="space-y-2">
            {activeOrders.map((o) => (
              <TapScale key={o.id}>
                <Link
                  href={`/portal/orders/${o.id}`}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3.5 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Package className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        Pedido #{o.orderNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {o.itemsCount} producto{o.itemsCount !== 1 ? "s" : ""} ·{" "}
                        {money(o.total)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        ORDER_STATUS_COLORS[o.status as OrderStatusKey]
                      }
                    >
                      {ORDER_STATUS_LABELS[o.status as OrderStatusKey]}
                    </Badge>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              </TapScale>
            ))}
          </div>
        </motion.section>
      )}

      {/* Banners / Publicaciones promocionales */}
      {banners.length > 0 && (
        <motion.section variants={item}>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
            {banners.map((pub) => (
              <div
                key={pub.id}
                className="relative shrink-0 overflow-hidden rounded-2xl"
                role="button"
                tabIndex={0}
                onClick={() => setDetailItem({ kind: "publication", id: pub.id, title: pub.title, content: pub.content, imageUrl: pub.imageUrl, type: pub.type, publishedAt: pub.publishedAt })}
                onKeyDown={(e) => e.key === "Enter" && setDetailItem({ kind: "publication", id: pub.id, title: pub.title, content: pub.content, imageUrl: pub.imageUrl, type: pub.type, publishedAt: pub.publishedAt })}
              >
                {pub.imageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pub.imageUrl}
                      alt={pub.title}
                      className="h-40 w-72 object-cover"
                    />
                    <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3.5">
                      <Badge
                        className={PUB_TYPE_COLORS[pub.type] ?? "bg-secondary"}
                      >
                        {PUB_TYPE_LABELS[pub.type] ?? pub.type}
                      </Badge>
                      <p className="mt-1.5 line-clamp-2 text-sm font-bold text-white">
                        {pub.title}
                      </p>
                      {pub.content && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-white/80">
                          {pub.content}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex h-24 w-72 flex-col justify-center border border-border/60 bg-card p-4 shadow-sm">
                    <Badge
                      className={cn("w-fit", PUB_TYPE_COLORS[pub.type] ?? "bg-secondary")}
                    >
                      {PUB_TYPE_LABELS[pub.type] ?? pub.type}
                    </Badge>
                    <p className="mt-1.5 line-clamp-1 text-sm font-bold">
                      {pub.title}
                    </p>
                    {pub.content && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {pub.content}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Promociones */}
      {data.promotions.length > 0 && (
        <motion.section variants={item}>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> Promociones
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
            {data.promotions.map((p) => (
              <Card
                key={p.id}
                className="w-56 shrink-0 overflow-hidden rounded-2xl border-border/50"
                role="button"
                tabIndex={0}
                onClick={() => setDetailItem({ kind: "promotion", id: p.id, name: p.name, description: p.description, descriptionFinal: p.descriptionFinal, imageUrl: p.imageUrl, benefit: p.benefit, value: p.value, startsAt: p.startsAt, endsAt: p.endsAt })}
                onKeyDown={(e) => e.key === "Enter" && setDetailItem({ kind: "promotion", id: p.id, name: p.name, description: p.description, descriptionFinal: p.descriptionFinal, imageUrl: p.imageUrl, benefit: p.benefit, value: p.value, startsAt: p.startsAt, endsAt: p.endsAt })}
              >
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="h-28 w-full object-cover"
                  />
                )}
                <div className="p-3">
                  <p className="text-sm font-semibold leading-tight">
                    {p.name}
                  </p>
                  {p.descriptionFinal && (
                    <p className="mt-1 text-xs leading-snug text-foreground/80">
                      {p.descriptionFinal}
                    </p>
                  )}
                  {p.description && p.description !== p.descriptionFinal && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {p.description}
                    </p>
                  )}
                  {(p.startsAt || p.endsAt) && (
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground/70">
                      <Calendar className="size-3" />
                      <span>
                        {p.startsAt && p.endsAt
                          ? `${new Date(p.startsAt).toLocaleDateString("es-MX", { month: "short", day: "numeric" })} — ${new Date(p.endsAt).toLocaleDateString("es-MX", { month: "short", day: "numeric" })}`
                          : p.startsAt
                            ? `Desde ${new Date(p.startsAt).toLocaleDateString("es-MX", { month: "short", day: "numeric" })}`
                            : `Hasta ${new Date(p.endsAt!).toLocaleDateString("es-MX", { month: "short", day: "numeric" })}`}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </motion.section>
      )}

      {/* Novedades */}
      {data.newProducts.length > 0 && (
        <motion.section variants={item}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Productos nuevos</h2>
            <Link
              href="/portal/store"
              className="flex items-center gap-0.5 text-xs text-primary font-medium"
            >
              Ver tienda <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {data.newProducts.slice(0, 8).map((p) => (
              <TapScale key={p.id}>
                <Link
                  href="/portal/store"
                  className="flex flex-col items-center gap-1 text-center"
                >
                  <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border bg-muted">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ShoppingBag className="size-5 text-muted-foreground/30" />
                    )}
                  </div>
                  <span className="line-clamp-2 text-[11px] leading-tight">
                    {p.name}
                  </span>
                </Link>
              </TapScale>
            ))}
          </div>
        </motion.section>
      )}

      {/* Publicaciones */}
      {data.publications.length > 0 && (
        <motion.section variants={item}>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Megaphone className="size-4 text-primary" /> Avisos
          </h2>
          <div className="space-y-2">
            {data.publications.map((pub) => (
              <div
                key={pub.id}
                className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-3.5 shadow-sm"
                role="button"
                tabIndex={0}
                onClick={() => setDetailItem({ kind: "publication", id: pub.id, title: pub.title, content: pub.content, imageUrl: pub.imageUrl, type: pub.type, publishedAt: pub.publishedAt })}
                onKeyDown={(e) => e.key === "Enter" && setDetailItem({ kind: "publication", id: pub.id, title: pub.title, content: pub.content, imageUrl: pub.imageUrl, type: pub.type, publishedAt: pub.publishedAt })}
              >
                {pub.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pub.imageUrl}
                    alt={pub.title}
                    className="size-12 shrink-0 rounded-xl object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">
                      {pub.title}
                    </p>
                    <Badge
                      className={PUB_TYPE_COLORS[pub.type] ?? "bg-secondary"}
                    >
                      {PUB_TYPE_LABELS[pub.type] ?? pub.type}
                    </Badge>
                  </div>
                  {pub.content && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {pub.content}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Detail sheet */}
      <DetailSheet
        open={!!detailItem}
        onOpenChange={(o) => !o && setDetailItem(null)}
        item={detailItem}
      />

      {/* Post-login permission sliders */}
      {activePerm && (
        <PermissionSlider
          type={activePerm}
          open={!!activePerm}
          onOpenChange={(open) => { if (!open) handlePermDone(activePerm) }}
          onGranted={() => handlePermDone(activePerm)}
          onDenied={() => handlePermDone(activePerm)}
        />
      )}
    </motion.div>
  )
}
