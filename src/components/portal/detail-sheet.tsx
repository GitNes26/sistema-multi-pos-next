"use client"

import { Calendar, Sparkles, Info } from "lucide-react"
import { BottomSheet } from "./bottom-sheet"
import { Badge } from "@/components/ui/badge"
import { money } from "@/lib/pos/money"

export interface DetailPublication {
  kind: "publication"
  id: string
  title: string
  content: string | null
  imageUrl: string | null
  type: string
  publishedAt: string | null
}

export interface DetailPromotion {
  kind: "promotion"
  id: string
  name: string
  description: string | null
  descriptionFinal: string | null
  imageUrl: string | null
  benefit: string
  value: number
  startsAt: string | null
  endsAt: string | null
}

export type DetailItem = DetailPublication | DetailPromotion

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

const BENEFIT_LABELS: Record<string, string> = {
  percent_off: "% de descuento",
  amount_off: "Descuento en $",
  fixed_price: "Precio fijo",
  buy_x_get_y: "Lleva X y paga Y",
  free_item: "Producto gratis",
  next_purchase_coupon: "Cupón para próxima compra",
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function PromosDetail({ item }: { item: DetailPromotion }) {
  return (
    <div className="space-y-4">
      {item.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt={item.name}
          className="h-48 w-full rounded-xl object-cover"
        />
      )}

      <div>
        <h3 className="text-lg font-bold">{item.name}</h3>
        <Badge className="mt-1 bg-amber-500 text-white">
          {BENEFIT_LABELS[item.benefit] ?? item.benefit}
        </Badge>
      </div>

      {item.descriptionFinal && (
        <p className="text-sm text-foreground/80 leading-relaxed">
          {item.descriptionFinal}
        </p>
      )}
      {item.description && item.description !== item.descriptionFinal && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {item.description}
        </p>
      )}

      {/* Detalles */}
      <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
        {item.benefit === "percent_off" && item.value > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="size-4 text-amber-500" />
            <span>
              <strong>{item.value}%</strong> de descuento
            </span>
          </div>
        )}
        {item.benefit === "amount_off" && item.value > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="size-4 text-amber-500" />
            <span>
              <strong>{money(item.value)}</strong> de descuento
            </span>
          </div>
        )}
        {item.benefit === "fixed_price" && item.value > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="size-4 text-amber-500" />
            <span>
              Precio fijo de <strong>{money(item.value)}</strong>
            </span>
          </div>
        )}

        {(item.startsAt || item.endsAt) && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="size-4 text-muted-foreground" />
            <span>
              {item.startsAt && item.endsAt
                ? `${formatDate(item.startsAt)} — ${formatDate(item.endsAt)}`
                : item.startsAt
                  ? `Desde ${formatDate(item.startsAt)}`
                  : `Hasta ${formatDate(item.endsAt!)}`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function PublicationDetail({ item }: { item: DetailPublication }) {
  return (
    <div className="space-y-4">
      {item.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt={item.title}
          className="h-48 w-full rounded-xl object-cover"
        />
      )}

      <div>
        <h3 className="text-lg font-bold">{item.title}</h3>
        <div className="mt-1 flex items-center gap-2">
          <Badge className={PUB_TYPE_COLORS[item.type] ?? "bg-secondary"}>
            {PUB_TYPE_LABELS[item.type] ?? item.type}
          </Badge>
          {item.publishedAt && (
            <span className="text-xs text-muted-foreground">
              {formatDate(item.publishedAt)}
            </span>
          )}
        </div>
      </div>

      {item.content && (
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {item.content}
        </p>
      )}

      {!item.content && (
        <div className="flex items-center gap-2 rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
          <Info className="size-4 shrink-0" />
          <span>Sin descripción adicional</span>
        </div>
      )}
    </div>
  )
}

export function DetailSheet({
  open,
  onOpenChange,
  item,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: DetailItem | null
}) {
  if (!item) return null

  const title = item.kind === "promotion" ? item.name : item.title
  const description =
    item.kind === "promotion"
      ? BENEFIT_LABELS[item.benefit] ?? "Promoción"
      : PUB_TYPE_LABELS[item.type] ?? item.type

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
    >
      {item.kind === "promotion" ? (
        <PromosDetail item={item} />
      ) : (
        <PublicationDetail item={item} />
      )}
    </BottomSheet>
  )
}
