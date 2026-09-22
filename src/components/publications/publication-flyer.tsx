"use client";

import { publicationDesign } from "@/lib/publications/designs";

const DEFAULT_COLORS: Record<string, [string, string]> = {
  "new-arrival": ["#064e3b", "#a7f3d0"],
  spotlight: ["#164e63", "#67e8f9"],
  "back-in-stock": ["#0f172a", "#e2e8f0"],
  "limited-offer": ["#78350f", "#fcd34d"],
  percentage: ["#881337", "#fda4af"],
  weekend: ["#4c1d95", "#c4b5fd"],
  schedule: ["#1e3a8a", "#93c5fd"],
  service: ["#134e4a", "#99f6e4"],
  maintenance: ["#7c2d12", "#fdba74"],
  general: ["#171717", "#f5f5f5"],
};

export function flyerColors(id: string | null | undefined): [string, string] {
  return DEFAULT_COLORS[id ?? ""] ?? DEFAULT_COLORS.general;
}

function readableText(hex: string): string {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? "#111827" : "#ffffff";
}

export function PublicationFlyer({
  designId, title, content, primaryColor, secondaryColor, compact = false,
}: {
  designId?: string | null;
  title: string;
  content?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  compact?: boolean;
}) {
  const design = publicationDesign(designId);
  const [defaultPrimary, defaultSecondary] = flyerColors(design.id);
  const primary = primaryColor && /^#[0-9a-f]{6}$/i.test(primaryColor) ? primaryColor : defaultPrimary;
  const secondary = secondaryColor && /^#[0-9a-f]{6}$/i.test(secondaryColor) ? secondaryColor : defaultSecondary;
  return (
    <div className={`relative isolate flex w-full flex-col justify-between overflow-hidden rounded-xl ${compact ? "min-h-32 p-3" : "min-h-52 p-5"}`} style={{ backgroundColor: primary, color: readableText(primary) }}>
      <div aria-hidden className="pointer-events-none absolute -right-8 -top-12 size-40 rotate-12 rounded-[2.5rem] opacity-25" style={{ backgroundColor: secondary }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-12 right-6 size-28 rotate-45 rounded-3xl opacity-15" style={{ backgroundColor: secondary }} />
      <div className="relative z-10 flex items-start justify-between gap-2">
        <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ backgroundColor: secondary, color: readableText(secondary) }}>{design.name}</span>
        <span className="text-[10px] font-semibold tabular-nums opacity-70">NESSIK</span>
      </div>
      <div className="relative z-10 mt-5 max-w-[90%]">
        <div className="mb-2 h-1 w-10 rounded-full" style={{ backgroundColor: secondary }} />
        <p className={`font-heading font-black leading-tight ${compact ? "line-clamp-2 text-lg" : "line-clamp-3 text-2xl"}`}>{title || design.title}</p>
        {content && <p className={`mt-2 leading-snug opacity-85 ${compact ? "line-clamp-2 text-xs" : "line-clamp-3 text-sm"}`}>{content}</p>}
      </div>
      {!compact && <div className="relative z-10 mt-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em]"><span className="size-1.5 rounded-full" style={{ backgroundColor: secondary }} /> Conoce los detalles</div>}
    </div>
  );
}
