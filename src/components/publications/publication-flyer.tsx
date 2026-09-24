"use client"

import { publicationDesign } from "@/lib/publications/designs"
import { cn } from "@/lib/utils"
import { ThumbImage } from "@/components/base/thumb-image"

const DEFAULT_COLORS: Record<string, [string, string]> = {
  "new-arrival": ["#064e3b", "#a7f3d0"], spotlight: ["#164e63", "#67e8f9"],
  "back-in-stock": ["#0f172a", "#e2e8f0"], "limited-offer": ["#78350f", "#fcd34d"],
  percentage: ["#881337", "#fda4af"], weekend: ["#4c1d95", "#c4b5fd"],
  schedule: ["#1e3a8a", "#93c5fd"], service: ["#134e4a", "#99f6e4"],
  maintenance: ["#7c2d12", "#fdba74"], general: ["#171717", "#f5f5f5"],
}

export function flyerColors(id: string | null | undefined): [string, string] {
  return DEFAULT_COLORS[id ?? ""] ?? DEFAULT_COLORS.general
}

function readableText(hex: string): string {
  const value = hex.replace("#", "")
  if (!/^[0-9a-f]{6}$/i.test(value)) return "#ffffff"
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16))
  return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? "#111827" : "#ffffff"
}

type FlyerProps = {
  designId?: string | null
  title: string
  content?: string | null
  imageUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  compact?: boolean
  className?: string
}

export function PublicationFlyer({ designId, title, content, imageUrl, primaryColor, secondaryColor, compact = false, className }: FlyerProps) {
  const design = publicationDesign(designId)
  const [defaultPrimary, defaultSecondary] = flyerColors(design.id)
  const primary = primaryColor && /^#[0-9a-f]{6}$/i.test(primaryColor) ? primaryColor : defaultPrimary
  const secondary = secondaryColor && /^#[0-9a-f]{6}$/i.test(secondaryColor) ? secondaryColor : defaultSecondary
  const foreground = readableText(primary)
  const accentForeground = readableText(secondary)
  const heading = title || design.title
  const copy = content || design.content
  const frame = cn("relative isolate w-full overflow-hidden rounded-xl", compact ? "h-40" : "h-64", className)
  const tag = <span className="inline-flex rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wide" style={{ backgroundColor: secondary, color: accentForeground }}>{design.name}</span>
  const text = (align = "") => <div className={cn("relative z-10", align)}><p className={cn("font-heading font-bold leading-tight", compact ? "line-clamp-2 text-lg" : "line-clamp-3 text-2xl")}>{heading}</p><p className={cn("mt-2 leading-snug opacity-85", compact ? "line-clamp-2 text-xs" : "line-clamp-3 text-sm")}>{copy}</p></div>
  const picture = (classes: string) => imageUrl ? <ThumbImage src={imageUrl} alt="" className={cn("absolute object-cover", classes)} /> : null

  if (design.id === "spotlight") return <div className={frame} style={{ backgroundColor: primary, color: foreground }}>{picture("inset-0 size-full")}<div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/5" /><div className="absolute inset-x-0 bottom-0 z-10 p-4 text-white">{tag}<div className="mt-3">{text()}</div></div></div>
  if (design.id === "back-in-stock") return <div className={cn(frame, "grid grid-cols-[42%_1fr] p-3")} style={{ backgroundColor: primary, color: foreground }}><div className="relative overflow-hidden rounded-lg border border-white/15" style={{ backgroundColor: secondary }}>{picture("inset-0 size-full")}{!imageUrl && <div className="absolute inset-0 grid place-items-center text-3xl font-black" style={{ color: accentForeground }}>↺</div>}</div><div className="z-10 flex min-w-0 flex-col justify-between pl-3">{tag}{text()}<span className="text-xs font-semibold opacity-70">Disponible nuevamente</span></div></div>
  if (design.id === "limited-offer") return <div className={cn(frame, "p-4")} style={{ backgroundColor: primary, color: foreground }}><div className="absolute -right-10 -top-10 size-48 rounded-full border-[18px] opacity-30" style={{ borderColor: secondary }} />{picture("right-3 top-3 size-28 rounded-full border-4")}<div className="relative z-10 flex h-full max-w-[65%] flex-col justify-between">{tag}{text()}<span className="text-xs font-bold uppercase tracking-wide">Tiempo limitado</span></div></div>
  if (design.id === "percentage") return <div className={cn(frame, "flex")} style={{ backgroundColor: primary, color: foreground }}><div className="relative w-[38%] shrink-0 overflow-hidden" style={{ backgroundColor: secondary }}>{picture("inset-0 size-full")}<span className="absolute inset-0 grid place-items-center text-5xl font-black opacity-50" style={{ color: accentForeground }}>%</span></div><div className="z-10 flex min-w-0 flex-1 flex-col justify-between p-4">{tag}{text("text-right")}<span className="text-right text-xs font-bold uppercase">Promoción especial</span></div></div>
  if (design.id === "weekend") return <div className={cn(frame, "p-4")} style={{ backgroundColor: primary, color: foreground }}><div className="absolute -bottom-3 -right-3 h-[82%] w-[48%] rotate-3 overflow-hidden rounded-xl border-4" style={{ borderColor: secondary, backgroundColor: secondary }}>{picture("inset-0 size-full")}</div><div className="relative z-10 flex h-full max-w-[58%] flex-col justify-between">{tag}{text()}<span className="text-xs font-bold uppercase tracking-wide">Solo este fin</span></div></div>
  if (design.id === "schedule") return <div className={cn(frame, "flex flex-col p-4 text-center")} style={{ backgroundColor: primary, color: foreground }}><div>{tag}</div><div className="mx-auto my-auto max-w-[88%]">{text()}</div><div className="relative -mx-4 -mb-4 h-14 overflow-hidden" style={{ backgroundColor: secondary }}>{picture("inset-0 size-full opacity-80")}</div></div>
  if (design.id === "service") return <div className={cn(frame, "grid grid-cols-[auto_1fr] items-center gap-4 p-4")} style={{ backgroundColor: primary, color: foreground }}><div className="relative size-24 overflow-hidden rounded-full border-4" style={{ borderColor: secondary, backgroundColor: secondary }}>{picture("inset-0 size-full")}</div><div className="min-w-0">{tag}<div className="mt-4">{text()}</div></div></div>
  if (design.id === "maintenance") return <div className={cn(frame, "p-4")} style={{ backgroundColor: primary, color: foreground }}><div className="absolute inset-x-0 top-0 h-3 opacity-80" style={{ background: `repeating-linear-gradient(135deg, ${secondary} 0 12px, transparent 12px 24px)` }} />{picture("right-4 top-7 size-24 rounded-lg border-2")}<div className="relative z-10 flex h-full max-w-[68%] flex-col justify-between pt-3">{tag}{text()}<span className="text-xs font-bold uppercase">Información de servicio</span></div></div>
  if (design.id === "general") return <div className={cn(frame, "p-5")} style={{ backgroundColor: primary, color: foreground }}>{picture("right-0 top-0 h-full w-[38%] opacity-75")}<div className="absolute inset-y-0 right-[34%] w-12 -skew-x-12" style={{ backgroundColor: primary }} /><div className="relative z-10 flex h-full max-w-[68%] flex-col justify-between"><span className="text-xs font-semibold uppercase tracking-widest opacity-70">Comunicado</span>{text()}<div className="h-px w-16" style={{ backgroundColor: secondary }} /></div></div>
  return <div className={cn(frame, "p-4")} style={{ backgroundColor: primary, color: foreground }}><div className="absolute inset-y-0 right-0 w-[46%] overflow-hidden rounded-l-[3rem]" style={{ backgroundColor: secondary }}>{picture("inset-0 size-full")}</div><div className="relative z-10 flex h-full max-w-[60%] flex-col justify-between">{tag}{text()}<span className="text-xs font-bold uppercase tracking-wide">Descúbrelo hoy</span></div></div>
}
