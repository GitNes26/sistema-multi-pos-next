"use client"

import { useState, type CSSProperties, type ReactNode } from "react"
import { publicationDesign, type PublicationDesign } from "@/lib/publications/designs"
import { cn } from "@/lib/utils"

// Flyer de publicación. Toda la tipografía y los espacios usan unidades del
// contenedor (cqw), así el mismo diseño se ve idéntico en la miniatura del
// panel, el carrusel del portal y el detalle a pantalla completa.
// La foto (propia o del producto relacionado) se integra en cada composición;
// sin foto, el hueco se rellena con el acento y el símbolo del diseño.

export function flyerColors(id: string | null | undefined): [string, string] {
  return publicationDesign(id).colors
}

function readableText(hex: string): string {
  const value = hex.replace("#", "")
  if (!/^[0-9a-f]{6}$/i.test(value)) return "#ffffff"
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16))
  return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? "#111827" : "#ffffff"
}

const validHex = (v: string | null | undefined) => (v && /^#[0-9a-f]{6}$/i.test(v) ? v : null)

type FlyerProps = {
  designId?: string | null
  title: string
  content?: string | null
  imageUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  /** Conservado por compatibilidad: el tamaño lo define el contenedor. */
  compact?: boolean
  className?: string
}

interface Ctx {
  d: PublicationDesign
  P: string
  A: string
  fg: string
  afg: string
  heading: string
  copy: string
  img: string | null
}

export function PublicationFlyer({ designId, title, content, imageUrl, primaryColor, secondaryColor, className }: FlyerProps) {
  const d = publicationDesign(designId)
  const P = validHex(primaryColor) ?? d.colors[0]
  const A = validHex(secondaryColor) ?? d.colors[1]
  const [broken, setBroken] = useState<string | null>(null)
  const img = imageUrl && imageUrl !== broken ? imageUrl : null
  const c: Ctx = { d, P, A, fg: readableText(P), afg: readableText(A), heading: title || d.title, copy: content || d.content, img }

  return (
    <div
      className={cn("@container relative isolate aspect-[16/10] w-full overflow-hidden rounded-2xl select-none", className)}
      style={{ backgroundColor: P, color: c.fg }}
      role="img"
      aria-label={`${c.heading}. ${c.copy}`}
    >
      {/* Precarga oculta para detectar imágenes rotas y caer al diseño sin foto. */}
      {imageUrl && imageUrl !== broken && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="hidden" onError={() => setBroken(imageUrl)} />
      )}
      <Layout c={c} />
    </div>
  )
}

// ── Piezas ────────────────────────────────────────────────────────────────

function Tag({ c, className }: { c: Ctx; className?: string }) {
  return (
    <span
      className={cn("inline-flex w-fit rounded-[1.4cqw] px-[2cqw] py-[0.9cqw] text-[2.5cqw] font-bold tracking-wide uppercase", className)}
      style={{ backgroundColor: c.A, color: c.afg }}
    >
      {c.d.name}
    </span>
  )
}

function Text({ c, className, size = 6.4, lines = 3, copyLines = 2 }: { c: Ctx; className?: string; size?: number; lines?: number; copyLines?: number }) {
  const clamp = (n: number): CSSProperties => ({ display: "-webkit-box", WebkitLineClamp: n, WebkitBoxOrient: "vertical", overflow: "hidden" })
  return (
    <div className={cn("relative z-10 min-w-0", className)}>
      <p className="font-heading leading-[1.05] font-bold tracking-tight" style={{ fontSize: `${size}cqw`, ...clamp(lines) }}>
        {c.heading}
      </p>
      {copyLines > 0 && (
        <p className="mt-[1.6cqw] leading-snug opacity-85" style={{ fontSize: "3.1cqw", ...clamp(copyLines) }}>
          {c.copy}
        </p>
      )}
    </div>
  )
}

function Footer({ c, className }: { c: Ctx; className?: string }) {
  return <span className={cn("relative z-10 text-[2.5cqw] font-bold tracking-wider uppercase opacity-80", className)}>{c.d.footer}</span>
}

/** Foto que llena su caja; sin foto, acento con el símbolo del diseño. */
function Photo({ c, className, glyphClassName, style }: { c: Ctx; className?: string; glyphClassName?: string; style?: CSSProperties }) {
  return (
    <div className={cn("overflow-hidden", className)} style={{ backgroundColor: c.A, ...style }}>
      {c.img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.img} alt="" className="size-full object-cover" draggable={false} />
      ) : (
        <span className={cn("grid size-full place-items-center font-black opacity-60", glyphClassName ?? "text-[10cqw]")} style={{ color: c.afg }}>
          {c.d.glyph ?? "✦"}
        </span>
      )}
    </div>
  )
}

function Column({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("relative z-10 flex h-full flex-col justify-between gap-[2cqw]", className)}>{children}</div>
}

// ── Composiciones ─────────────────────────────────────────────────────────

function Layout({ c }: { c: Ctx }) {
  const pad = "p-[5cqw]"
  switch (c.d.layout) {
    case "full-bleed":
      return (
        <>
          {c.img ? (
            <Photo c={c} className="absolute inset-0" />
          ) : (
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 80% 20%, ${c.A}66, transparent 60%)` }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
          <div className={cn("absolute inset-x-0 bottom-0 flex flex-col gap-[2cqw] text-white", pad)}>
            <Tag c={c} />
            <Text c={c} size={7} lines={2} />
          </div>
        </>
      )

    case "card-left":
      return (
        <div className={cn("grid h-full grid-cols-[42%_1fr] gap-[4cqw] p-[3.5cqw]")}>
          <Photo c={c} className="relative rounded-[3cqw] border border-white/15" />
          <Column className="py-[1.5cqw] pr-[1.5cqw]">
            <Tag c={c} />
            <Text c={c} size={5.8} />
            <Footer c={c} />
          </Column>
        </div>
      )

    case "circle-burst":
      return (
        <div className={cn("relative h-full", pad)}>
          <div className="absolute -top-[12cqw] -right-[12cqw] size-[62cqw] rounded-full border-[5cqw] opacity-25" style={{ borderColor: c.A }} />
          <Photo c={c} className="absolute top-[5cqw] right-[5cqw] size-[34cqw] rounded-full border-[1.2cqw]" style={{ borderColor: c.A }} />
          <Column className="max-w-[58%]">
            <Tag c={c} />
            <Text c={c} />
            <Footer c={c} />
          </Column>
        </div>
      )

    case "side-strip":
      return (
        <div className="flex h-full">
          <div className="relative w-[38%] shrink-0">
            <Photo c={c} className="absolute inset-0" glyphClassName="text-[20cqw]" />
            {c.img && c.d.glyph && (
              <span className="absolute right-[2cqw] bottom-[2cqw] rounded-[2cqw] px-[2cqw] text-[7cqw] font-black" style={{ backgroundColor: c.A, color: c.afg }}>
                {c.d.glyph}
              </span>
            )}
          </div>
          <Column className={cn("flex-1 items-end text-right", pad)}>
            <Tag c={c} />
            <Text c={c} />
            <Footer c={c} />
          </Column>
        </div>
      )

    case "tilted":
      return (
        <div className={cn("relative h-full", pad)}>
          <Photo c={c} className="absolute -right-[3cqw] -bottom-[3cqw] h-[82%] w-[46%] rotate-3 rounded-[3cqw] border-[1.2cqw] shadow-2xl" style={{ borderColor: c.A }} />
          <Column className="max-w-[56%]">
            <Tag c={c} />
            <Text c={c} />
            <Footer c={c} />
          </Column>
        </div>
      )

    case "banner-bottom":
      return (
        <div className="flex h-full flex-col text-center">
          <div className={cn("flex flex-1 flex-col items-center justify-center gap-[2cqw] px-[6cqw] pt-[4cqw]")}>
            <Tag c={c} />
            <Text c={c} size={6} lines={2} />
          </div>
          <Photo c={c} className="relative h-[26%] w-full" glyphClassName="text-[7cqw]" />
        </div>
      )

    case "avatar":
      return (
        <div className={cn("grid h-full grid-cols-[auto_1fr] items-center gap-[5cqw]", pad)}>
          <Photo c={c} className="size-[30cqw] rounded-full border-[1.2cqw]" style={{ borderColor: c.A }} />
          <div className="flex flex-col gap-[2.5cqw]">
            <Tag c={c} />
            <Text c={c} size={5.6} />
          </div>
        </div>
      )

    case "hazard":
      return (
        <div className={cn("relative h-full", pad)}>
          <div className="absolute inset-x-0 top-0 h-[3.5cqw]" style={{ background: `repeating-linear-gradient(135deg, ${c.A} 0 3cqw, transparent 3cqw 6cqw)` }} />
          <Photo c={c} className="absolute top-[9cqw] right-[5cqw] size-[28cqw] rounded-[3cqw] border-[0.6cqw]" style={{ borderColor: c.A }} glyphClassName="text-[16cqw]" />
          <Column className="max-w-[64%] pt-[2cqw]">
            <Tag c={c} />
            <Text c={c} />
            <Footer c={c} />
          </Column>
        </div>
      )

    case "editorial":
      return (
        <div className={cn("relative h-full", pad)}>
          <Photo c={c} className="absolute inset-y-0 right-0 w-[40%]" glyphClassName="text-[14cqw]" />
          <div className="absolute inset-y-0 right-[35%] w-[10cqw] -skew-x-12" style={{ backgroundColor: c.P }} />
          <Column className="max-w-[62%]">
            <span className="text-[2.5cqw] font-semibold tracking-[0.3em] uppercase opacity-70">{c.d.footer}</span>
            <Text c={c} />
            <div className="h-[0.5cqw] w-[14cqw]" style={{ backgroundColor: c.A }} />
          </Column>
        </div>
      )

    case "polaroid":
      return (
        <div className={cn("relative h-full", pad)}>
          <div className="absolute top-[6cqw] right-[6cqw] w-[38%] -rotate-3 bg-white p-[1.6cqw] pb-[6cqw] shadow-2xl">
            <Photo c={c} className="aspect-square w-full" glyphClassName="text-[12cqw]" />
            <span className="absolute inset-x-0 bottom-[1.6cqw] text-center text-[2.4cqw] font-semibold text-neutral-700">{c.d.footer}</span>
          </div>
          <Column className="max-w-[54%]">
            <Tag c={c} />
            <Text c={c} />
            <span />
          </Column>
        </div>
      )

    case "sticker":
      return (
        <div className={cn("relative h-full", pad)}>
          <Photo c={c} className="absolute top-[5cqw] right-[5cqw] bottom-[5cqw] w-[44%] rounded-[4cqw]" glyphClassName="text-[12cqw]" />
          <span
            className="absolute top-[3cqw] right-[40%] z-20 grid size-[19cqw] rotate-[-12deg] place-items-center rounded-full text-center leading-none font-black shadow-xl"
            style={{ backgroundColor: c.A, color: c.afg, fontSize: (c.d.glyph ?? "").length > 3 ? "3.6cqw" : "6.5cqw" }}
          >
            {c.d.glyph ?? "¡Ya!"}
          </span>
          <Column className="max-w-[50%] pt-[14cqw]">
            <Text c={c} size={6} />
            <Footer c={c} />
          </Column>
        </div>
      )

    case "magazine":
      return (
        <div className="flex h-full flex-col">
          <div className="relative h-[56%]">
            <Photo c={c} className="absolute inset-0" glyphClassName="text-[14cqw]" />
            <span className="absolute top-[4cqw] left-[5cqw] rounded-[1.4cqw] px-[2cqw] py-[0.9cqw] text-[2.5cqw] font-bold tracking-wide uppercase" style={{ backgroundColor: c.P, color: c.fg }}>
              {c.d.name}
            </span>
          </div>
          <div className="flex flex-1 items-center justify-between gap-[4cqw] px-[5cqw]">
            <Text c={c} size={5.4} lines={2} copyLines={1} />
            <span className="shrink-0 rounded-full px-[2.5cqw] py-[1cqw] text-[2.4cqw] font-bold uppercase" style={{ border: `0.3cqw solid ${c.A}` }}>
              {c.d.footer}
            </span>
          </div>
        </div>
      )

    case "ticket":
      return (
        <div className="relative flex h-full">
          {/* Muescas del cupón */}
          <span className="absolute top-1/2 -left-[3cqw] z-20 size-[6cqw] -translate-y-1/2 rounded-full bg-background" />
          <span className="absolute top-1/2 -right-[3cqw] z-20 size-[6cqw] -translate-y-1/2 rounded-full bg-background" />
          <Column className={cn("w-[66%]", pad)}>
            <Tag c={c} />
            <Text c={c} size={5.8} />
            <Footer c={c} />
          </Column>
          <div className="relative flex flex-1 flex-col items-center justify-center gap-[2cqw] border-l-[0.5cqw] border-dashed" style={{ borderColor: `${c.fg}55`, backgroundColor: c.A, color: c.afg }}>
            {c.img && <Photo c={c} className="size-[18cqw] rounded-full border-[0.8cqw] border-white/60" />}
            <span className="text-[9cqw] leading-none font-black">{c.d.glyph ?? "✦"}</span>
          </div>
        </div>
      )

    case "halo":
      return (
        <div className={cn("relative grid h-full grid-cols-[1fr_auto] items-center gap-[4cqw]", pad)}>
          <div className="absolute top-1/2 right-[4cqw] size-[56cqw] -translate-y-1/2 rounded-full" style={{ background: `radial-gradient(circle, ${c.A}88 0%, transparent 65%)` }} />
          <div className="flex flex-col gap-[2.5cqw]">
            <Tag c={c} />
            <Text c={c} />
            <Footer c={c} />
          </div>
          <div className="relative">
            <div className="absolute -inset-[3cqw] rounded-full border-[0.4cqw] opacity-60" style={{ borderColor: c.A }} />
            <Photo c={c} className="size-[34cqw] rounded-full shadow-2xl" />
          </div>
        </div>
      )

    case "dots":
      return (
        <div className={cn("relative h-full", pad)}>
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: `radial-gradient(${c.A} 0.7cqw, transparent 0.8cqw)`, backgroundSize: "5cqw 5cqw" }} />
          <Photo c={c} className="absolute top-[6cqw] right-[6cqw] size-[36cqw] rotate-6 rounded-[4cqw] border-[1cqw] shadow-2xl" style={{ borderColor: c.A }} />
          {c.d.glyph && (
            <span className="absolute top-[3cqw] right-[3cqw] z-20 rotate-6 rounded-[2cqw] px-[2cqw] py-[0.5cqw] text-[6cqw] font-black shadow-lg" style={{ backgroundColor: c.A, color: c.afg }}>
              {c.d.glyph}
            </span>
          )}
          <Column className="max-w-[54%]">
            <Tag c={c} />
            <Text c={c} size={7} lines={2} />
            <Footer c={c} />
          </Column>
        </div>
      )

    case "stamp":
      return (
        <div className={cn("relative grid h-full grid-cols-[1fr_auto] items-center gap-[4cqw]", pad)}>
          <Column>
            <Tag c={c} />
            <Text c={c} />
            <Footer c={c} />
          </Column>
          <div className="grid size-[34cqw] rotate-[-8deg] place-items-center rounded-full border-[0.8cqw] border-dashed p-[2cqw]" style={{ borderColor: c.A }}>
            {c.img ? (
              <Photo c={c} className="size-full rounded-full" />
            ) : (
              <span className="text-[16cqw] leading-none font-black" style={{ color: c.A }}>{c.d.glyph ?? "!"}</span>
            )}
          </div>
        </div>
      )

    case "arc":
    default:
      return (
        <div className={cn("relative h-full", pad)}>
          <Photo c={c} className="absolute inset-y-0 right-0 w-[46%] rounded-l-[16cqw]" glyphClassName="text-[14cqw]" />
          <Column className="max-w-[56%]">
            <Tag c={c} />
            <Text c={c} />
            <Footer c={c} />
          </Column>
        </div>
      )
  }
}
