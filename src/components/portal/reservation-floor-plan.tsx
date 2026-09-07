"use client";

import { cn } from "@/lib/utils";

// Plano de mesa compartido: dibuja una sala (o las mesas sueltas) en su
// posición real con la forma/tamaño de cada mesa. Lo usan la reservación con
// cuenta (portal) y la reservación de invitado (/reservar) para que el plano
// luzca idéntico en ambos flujos.

export interface PlanTable {
  id: string;
  number: number;
  name: string | null;
  capacity: number;
  shape: string;
  width: number | null;
  height: number | null;
  posX: number | null;
  posY: number | null;
  status: string;
}

const CANVAS_W = 760;
const CANVAS_H = 420;
const SCALE = 0.62;

function sizeOf(shape: string): { width: number; height: number } {
  if (shape === "rectangle" || shape === "booth") return { width: 140, height: 76 };
  if (shape === "bar") return { width: 168, height: 56 };
  return { width: 84, height: 84 };
}

function shapeClass(shape: string) {
  if (shape === "round" || shape === "bar") return "rounded-full";
  if (shape === "booth") return "rounded-xl";
  return "rounded-lg";
}

export function ReservationFloorPlan({
  tables,
  party,
  takenIds,
  selectedId,
  onSelect,
}: {
  tables: PlanTable[];
  party: number;
  takenIds: string[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:22px_22px]"
      style={{ height: Math.round(CANVAS_H * SCALE) }}
    >
      {tables.map((t, i) => {
        const size = sizeOf(t.shape);
        const w = Math.round((t.width ?? size.width) * SCALE);
        const h = Math.round((t.height ?? size.height) * SCALE);
        const x = t.posX != null ? Math.round(t.posX * SCALE) : 40 + (i % 4) * 150;
        const y = t.posY != null ? Math.round(t.posY * SCALE) : 30 + Math.floor(i / 4) * 90;
        const disabled = t.status === "occupied" || takenIds.includes(t.id) || t.capacity < party;
        const selected = selectedId === t.id;
        return (
          <button
            key={t.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(selected ? null : t.id)}
            className={cn(
              "absolute flex touch-none flex-col items-center justify-center border-2 text-center transition",
              shapeClass(t.shape),
              disabled
                ? "border-slate-300 bg-slate-100 text-slate-400"
                : selected
                  ? "z-10 border-primary bg-primary/15 text-primary ring-2 ring-primary"
                  : "border-emerald-400 bg-emerald-500/15 text-emerald-700"
            )}
            style={{ left: x, top: y, width: w, height: h, transform: "translate(-50%, -50%)" }}
            title={`Mesa ${t.number} · ${t.capacity} pers.${disabled ? " · no disponible" : ""}`}
          >
            <span className="text-xs font-bold leading-none">{t.number}</span>
            <span className="text-[8px] leading-tight opacity-80">{t.capacity}</span>
          </button>
        );
      })}
    </div>
  );
}