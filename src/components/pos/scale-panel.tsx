"use client";

import { Loader2, Plug, PlugZap, Scale, Sparkles, Unplug } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnimatedNumber } from "@/components/base/animated-number";
import { scale, useScale, type ScaleState } from "@/lib/pos/scale";
import { money } from "@/lib/pos/money";
import { cn } from "@/lib/utils";

const BAUD_RATES = [2400, 4800, 9600, 19200, 38400, 57600, 115200];

export const scaleIsLive = (s: ScaleState) => s.status === "connected" || s.status === "demo";

const STATUS_LABEL: Record<ScaleState["status"], string> = {
  unsupported: "Navegador sin soporte",
  disconnected: "Sin báscula",
  connecting: "Conectando…",
  connected: "Báscula conectada",
  demo: "Báscula de prueba",
  error: "Error de báscula",
};

/** Botón del encabezado del POS: estado, conexión y ajustes de la báscula. */
export function ScaleStatusButton() {
  const s = useScale();
  const live = scaleIsLive(s);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "press flex h-11 shrink-0 touch-manipulation items-center gap-2 rounded-xl border px-3 text-sm font-medium whitespace-nowrap",
            live ? "border-success/30 bg-success/10" : s.status === "error" ? "border-destructive/40 bg-destructive/10 text-destructive" : "text-muted-foreground"
          )}
          title={STATUS_LABEL[s.status]}
        >
          <Scale className={cn("size-4", live && "text-success")} />
          <span className="hidden tabular-nums lg:inline">{live && s.kg != null ? `${s.kg.toFixed(3)} kg` : "Báscula"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div>
          <p className="font-semibold">{STATUS_LABEL[s.status]}</p>
          <p className="text-xs text-muted-foreground">
            {s.status === "unsupported"
              ? "Para leer la báscula usa Chrome o Edge en una computadora (Web Serial)."
              : "Conecta la báscula por USB/serie. Al pesar un producto a granel, el peso y el precio se calculan solos."}
          </p>
          {s.error && <p className="mt-1 text-xs text-destructive">{s.error}</p>}
        </div>
        {live && (
          <div className="rounded-xl bg-foreground px-4 py-3 text-background">
            <p className="text-xs opacity-70">Lectura actual</p>
            <p className="font-heading text-3xl font-semibold tabular-nums">
              {(s.kg ?? 0).toFixed(3)}
              <span className="ml-1 text-base opacity-60">kg</span>
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Velocidad (baudios)</Label>
            <select
              value={s.config.baudRate}
              onChange={(e) => scale.setConfig({ baudRate: Number(e.target.value) })}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {BAUD_RATES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Comando de lectura</Label>
            <Input value={s.config.command} onChange={(e) => scale.setConfig({ command: e.target.value })} placeholder="Vacío = continuo" className="h-9" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Si tu báscula solo responde al pedirle el peso, escribe su comando (muchas usan &quot;P&quot;). Los cambios aplican al reconectar.</p>
        <div className="flex flex-wrap gap-2">
          {live || s.status === "connecting" ? (
            <Button variant="outline" size="sm" onClick={() => void scale.disconnect()}>
              {s.status === "connecting" ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />} Desconectar
            </Button>
          ) : (
            <Button size="sm" onClick={() => void scale.connect()} disabled={s.status === "unsupported"}>
              <Plug className="size-4" />
              Conectar báscula
            </Button>
          )}
          {s.status !== "demo" && (
            <Button variant="ghost" size="sm" onClick={() => void scale.demo()}>
              <Sparkles className="size-4" /> Probar sin báscula
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Lectura en vivo: peso animado, barra de carga y precio calculado (igual que
 * la demostración "Venta a granel, sin trucos" de la página principal).
 */
export function ScaleReadout({
  quantity,
  unitAbbrev,
  pricePerUnit,
  stable,
  following,
  demo,
  maxQty,
  onFollow,
}: {
  quantity: number;
  unitAbbrev: string;
  pricePerUnit: number;
  stable: boolean;
  following: boolean;
  demo: boolean;
  maxQty?: number;
  onFollow: () => void;
}) {
  const decimals = unitAbbrev.toLowerCase() === "g" ? 0 : 3;
  const scaleMax = maxQty && Number.isFinite(maxQty) ? maxQty : unitAbbrev.toLowerCase() === "g" ? 3000 : 3;
  return (
    <div className="rounded-2xl bg-foreground p-4 text-background">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 opacity-70">
          <Scale className="size-3.5" /> {demo ? "Báscula de prueba" : "Báscula conectada"}
        </span>
        {following ? (
          <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold", stable ? "bg-success text-white" : "bg-background/15")}>
            <span className={cn("size-1.5 rounded-full", stable ? "bg-white" : "animate-pulse bg-warning")} />
            {stable ? "Peso estable" : "Pesando…"}
          </span>
        ) : (
          <button type="button" onClick={onFollow} className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 font-semibold text-primary-foreground">
            <PlugZap className="size-3" /> Usar báscula
          </button>
        )}
      </div>
      <p className="mt-1 font-heading text-5xl font-semibold tracking-tight tabular-nums">
        <AnimatedNumber value={quantity} duration={0.45} format={(v) => v.toFixed(decimals)} />
        <span className="ml-1 text-xl opacity-60">{unitAbbrev}</span>
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background/15">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${Math.min(quantity / scaleMax, 1) * 100}%` }} />
      </div>
      <div className="mt-3 flex items-baseline justify-between border-t border-background/15 pt-3">
        <span className="text-sm opacity-70">
          {money(pricePerUnit)} / {unitAbbrev}
        </span>
        <span className="font-heading text-2xl font-semibold tabular-nums">
          <AnimatedNumber value={Math.round(quantity * pricePerUnit * 100) / 100} duration={0.45} format={(v) => money(v)} />
        </span>
      </div>
    </div>
  );
}
