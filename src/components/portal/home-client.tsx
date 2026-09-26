"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion, useTransform } from "framer-motion"
import {
  ArrowRight,
  Calendar,
  CalendarCheck2,
  ChevronRight,
  Megaphone,
  Package,
  Puzzle,
  ShoppingBag,
  Sparkles,
} from "lucide-react"
import { portalApi } from "@/lib/portal/client"
import type { PortalHomeData } from "@/lib/portal/server"
import { ThumbImage } from "@/components/base/thumb-image"
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
import { STAGGER_FADE_UP } from "@/lib/animation-tokens"
import { DetailSheet, type DetailItem } from "@/components/portal/detail-sheet"
import { PortalComboCard } from "@/components/portal/combo-card"
import { MaskReveal, MaskRevealImage } from "@/components/shared/mask-reveal"
import { useParallax } from "@/hooks/use-parallax"
import { PullToRefresh } from "@/components/shared/pull-to-refresh"
import { PublicationFlyer } from "@/components/publications/publication-flyer"

const PUB_TYPE_LABELS: Record<string, string> = {
  product_new: "Nuevo",
  promotion: "Promoción",
  notice: "Aviso",
}

const PUB_TYPE_COLORS: Record<string, string> = {
  product_new: "bg-success text-success-foreground",
  promotion: "bg-warning text-warning-foreground",
  notice: "bg-info text-info-foreground",
}

const { container, item } = STAGGER_FADE_UP;

/* ─────────────────────────────────────────────────────────────
 *  HeroParallaxCard — Puntos hero with parallax decorative circles
 * ───────────────────────────────────────────────────────────── */
function HeroParallaxCard({ points }: { points: number }) {
  const { ref, y } = useParallax(0.4, { offset: ["start start", "end start"] })

  return (
    <motion.div variants={item}>
      <Link href="/portal/loyalty" className="block">
        {/* Tarjeta de lealtad tipo "wallet": el saldo de puntos es el protagonista */}
        <div ref={ref} className="press relative overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground shadow-e2">
          <motion.svg
            aria-hidden
            viewBox="0 0 200 200"
            className="absolute -top-16 -right-16 size-56 opacity-20"
            style={{ y: useTransform(y, (v) => v * 0.5) }}
          >
            {[96, 76, 56, 36].map((r) => (
              <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeWidth="1.5" />
            ))}
          </motion.svg>
          <div className="relative flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium opacity-85">Tus puntos</p>
              <motion.p
                className="mt-1 font-heading text-4xl leading-none font-bold tracking-tight tabular"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                {qty(points)}
                <small className="ml-1 text-sm font-semibold opacity-80">pts</small>
              </motion.p>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-sm font-semibold">
              Canjear <ArrowRight className="size-3.5" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────────────────────
 *  PromoParallaxImage — Promotion card image with subtle parallax
 * ───────────────────────────────────────────────────────────── */
function PromoParallaxImage({ src, alt }: { src: string; alt: string }) {
  const { ref, y } = useParallax(0.1, { offset: ["start end", "end start"] })

  return (
    <MaskReveal shape="inset" className="h-28 w-full overflow-hidden">
      <div ref={ref} className="h-28 w-full overflow-hidden">
        <motion.img
          src={src}
          alt={alt}
          className="h-[115%] w-full object-cover -mt-[7%]"
          style={{ y }}
        />
      </div>
    </MaskReveal>
  )
}

export function HomeClient() {
  const [data, setData] = useState<PortalHomeData | null>(null)
  const [error, setError] = useState<string | null>(null)
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

  // Los permisos ya no se piden en cadena al entrar: cada uno se solicita en
  // su contexto (ubicación al pagar, notificaciones al seguir un pedido).

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

  const refreshData = async () => {
    try {
      const d = await portalApi.home()
      setData(d)
    } catch {}
  }

  return (
    <PullToRefresh onRefresh={refreshData}>
    <motion.div
      className="space-y-7 p-4 pb-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Puntos hero — parallax decorative circles */}
      <HeroParallaxCard points={data.points} />

      {/* Reservar mesa — accesible desde el inicio del portal */}
      {(data.businessMode === "food_service" || data.businessMode === "hybrid") && <motion.section variants={item}>
        <Link
          href="/portal/reservations"
          className="press flex min-h-16 items-center gap-3 rounded-2xl border border-primary/20 bg-accent/60 p-3.5"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CalendarCheck2 className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Reservar mesa</p>
            <p className="text-xs text-muted-foreground">
              Elige tu mesa desde el plano del local
            </p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Link>
      </motion.section>}

      {/* Pedidos activos */}
      {activeOrders.length > 0 && (
        <motion.section variants={item}>
          <h2 className="mb-2.5 font-heading text-lg font-semibold tracking-tight">Pedidos activos</h2>
          <div className="space-y-2">
            {activeOrders.map((o) => (
              <TapScale key={o.id}>
                <Link
                  href={`/portal/orders/${o.id}`}
                  className="flex min-h-16 items-center justify-between rounded-2xl border bg-card p-3.5"
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
          <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 scrollbar-none">
            {banners.map((pub) => (
              <div
                key={pub.id}
                className="relative shrink-0 snap-start overflow-hidden rounded-2xl"
                role="button"
                tabIndex={0}
                onClick={() => setDetailItem({ kind: "publication", id: pub.id, title: pub.title, content: pub.content, imageUrl: pub.imageUrl, type: pub.type, publishedAt: pub.publishedAt })}
                onKeyDown={(e) => e.key === "Enter" && setDetailItem({ kind: "publication", id: pub.id, title: pub.title, content: pub.content, imageUrl: pub.imageUrl, type: pub.type, publishedAt: pub.publishedAt })}
              >
                <PublicationFlyer className="w-[min(19rem,calc(100vw-2rem))]" compact designId={pub.designId} title={pub.title} content={pub.content} imageUrl={pub.imageUrl} primaryColor={pub.primaryColor} secondaryColor={pub.secondaryColor} />
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Promociones */}
      {data.promotions.length > 0 && (
        <motion.section variants={item}>
          <h2 className="mb-2.5 flex items-center gap-1.5 font-heading text-lg font-semibold tracking-tight">
            <Sparkles className="size-4 text-primary" /> Promociones
          </h2>
          <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 scrollbar-none">
            {data.promotions.map((p) => (
              <Card
                key={p.id}
                className="w-60 shrink-0 snap-start overflow-hidden rounded-2xl"
                role="button"
                tabIndex={0}
                onClick={() => setDetailItem({ kind: "promotion", id: p.id, name: p.name, description: p.description, descriptionFinal: p.descriptionFinal, imageUrl: p.imageUrl, benefit: p.benefit, value: p.value, startsAt: p.startsAt, endsAt: p.endsAt })}
                onKeyDown={(e) => e.key === "Enter" && setDetailItem({ kind: "promotion", id: p.id, name: p.name, description: p.description, descriptionFinal: p.descriptionFinal, imageUrl: p.imageUrl, benefit: p.benefit, value: p.value, startsAt: p.startsAt, endsAt: p.endsAt })}
              >
                {p.imageUrl && (
                  <PromoParallaxImage src={p.imageUrl} alt={p.name} />
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
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {p.description}
                    </p>
                  )}
                  {(p.startsAt || p.endsAt) && (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground/70">
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

      {/* Combos */}
      {data.combos && data.combos.length > 0 && (
        <motion.section variants={item}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="flex items-center gap-1.5 font-heading text-lg font-semibold tracking-tight">
              <Puzzle className="size-4 text-primary" /> Combos especiales
            </h2>
            <Link
              href="/portal/store"
              className="-mr-2 flex min-h-11 items-center gap-0.5 px-2 text-sm font-medium text-primary"
            >
              Ver tienda <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 scrollbar-none">
            {data.combos.map((c) => (
              <PortalComboCard key={c.id} combo={c} />
            ))}
          </div>
        </motion.section>
      )}

      {/* Novedades */}
      {data.newProducts.length > 0 && (
        <motion.section variants={item}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-heading text-lg font-semibold tracking-tight">Productos nuevos</h2>
            <Link
              href="/portal/store"
              className="-mr-2 flex min-h-11 items-center gap-0.5 px-2 text-sm font-medium text-primary"
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
                  <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-surface-sunken">
                    {p.imageUrl ? (
                      <MaskRevealImage
                        src={p.imageUrl}
                        alt={p.name}
                        shape="circle"
                        className="aspect-square w-full"
                        imgClassName="h-full w-full object-cover"
                      />
                    ) : (
                      <ShoppingBag className="size-5 text-muted-foreground/30" />
                    )}
                  </div>
                  <span className="line-clamp-2 text-xs leading-tight">
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
          <h2 className="mb-2.5 flex items-center gap-1.5 font-heading text-lg font-semibold tracking-tight">
            <Megaphone className="size-4 text-primary" /> Avisos
          </h2>
          <div className="space-y-2">
            {data.publications.map((pub) => (
              <div
                key={pub.id}
                className="press flex items-start gap-3 rounded-2xl border bg-card p-3.5"
                role="button"
                tabIndex={0}
                onClick={() => setDetailItem({ kind: "publication", id: pub.id, title: pub.title, content: pub.content, imageUrl: pub.imageUrl, type: pub.type, publishedAt: pub.publishedAt })}
                onKeyDown={(e) => e.key === "Enter" && setDetailItem({ kind: "publication", id: pub.id, title: pub.title, content: pub.content, imageUrl: pub.imageUrl, type: pub.type, publishedAt: pub.publishedAt })}
              >
                {pub.imageUrl && (
                  <ThumbImage
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
    </motion.div>
    </PullToRefresh>
  )
}
