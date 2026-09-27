"use client";

import { useSyncExternalStore } from "react";

// Báscula conectada al POS (Web Serial, Chrome/Edge de escritorio).
//
// La mayoría de las básculas comerciales (Torrey, Rhino, Ohaus, Tor-Rey L-EQ,
// CAS…) envían el peso como texto por el puerto serie/USB, ya sea de forma
// continua o al recibir un comando (p. ej. "P"). Aquí se lee ese flujo, se
// extrae el número y la unidad, y se publica en un pequeño store global para
// que cualquier pantalla (p. ej. el modal de granel) lo muestre en vivo.
//
// La configuración es del equipo (cada caja tiene su báscula), por eso se
// guarda en el navegador y no en la base de datos.

export interface ScaleConfig {
  baudRate: number;
  /** Comando para pedir el peso (vacío = la báscula transmite sola). */
  command: string;
  /** Cada cuánto se pide el peso cuando hay comando (ms). */
  intervalMs: number;
}

export type ScaleStatus = "unsupported" | "disconnected" | "connecting" | "connected" | "demo" | "error";

export interface ScaleState {
  status: ScaleStatus;
  /** Peso en kilogramos (null si aún no hay lectura). */
  kg: number | null;
  /** El peso lleva un momento sin cambiar. */
  stable: boolean;
  error: string | null;
  config: ScaleConfig;
}

const STORAGE_KEY = "multi-pos.scale";
const DEFAULT_CONFIG: ScaleConfig = { baudRate: 9600, command: "", intervalMs: 300 };

// Tipos mínimos de Web Serial (no vienen en lib.dom de TypeScript).
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}
interface SerialLike {
  requestPort(): Promise<SerialPortLike>;
  getPorts(): Promise<SerialPortLike[]>;
}
const serial = (): SerialLike | null =>
  typeof navigator !== "undefined" && "serial" in navigator ? ((navigator as unknown as { serial: SerialLike }).serial) : null;

function loadConfig(): ScaleConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<ScaleConfig>) };
  } catch {
    /* sin almacenamiento */
  }
  return DEFAULT_CONFIG;
}

let state: ScaleState = { status: "disconnected", kg: null, stable: false, error: null, config: DEFAULT_CONFIG };
let initialized = false;
const listeners = new Set<() => void>();
const emit = (patch: Partial<ScaleState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

let port: SerialPortLike | null = null;
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let demoTimer: ReturnType<typeof setInterval> | null = null;
let stableTimer: ReturnType<typeof setTimeout> | null = null;

/** Extrae el peso (en kg) de una línea de la báscula: "ST,GS,  1.250kg", "  1250 g", "2.75 lb"… */
export function parseScaleLine(line: string): number | null {
  const m = line.replace(/(\d),(\d)/g, "$1.$2").match(/([-+]?\d+(?:\.\d+)?)\s*(kg|g|lb|oz)?/i);
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return null;
  const unit = (m[2] ?? "kg").toLowerCase();
  const kg = unit === "g" ? value / 1000 : unit === "lb" ? value * 0.45359237 : unit === "oz" ? value * 0.028349523 : value;
  return Math.max(0, Math.round(kg * 1000) / 1000);
}

function pushReading(kg: number) {
  const changed = state.kg == null || Math.abs(kg - state.kg) >= 0.002;
  if (changed) {
    emit({ kg, stable: false });
    if (stableTimer) clearTimeout(stableTimer);
    stableTimer = setTimeout(() => emit({ stable: true }), 700);
  }
}

function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  state = { ...state, config: loadConfig(), status: serial() ? "disconnected" : "unsupported" };
  // Reconecta sola si el navegador ya tiene permiso sobre un puerto.
  void serial()
    ?.getPorts()
    .then((ports) => {
      if (ports[0]) void openPort(ports[0]);
    })
    .catch(() => undefined);
}

async function readLoop(p: SerialPortLike) {
  const decoder = new TextDecoder();
  let buffer = "";
  while (p.readable && port === p) {
    reader = p.readable.getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split(/[\r\n\x02\x03]+/);
        buffer = parts.pop() ?? "";
        for (const line of parts) {
          const kg = parseScaleLine(line);
          if (kg != null) pushReading(kg);
        }
        // Básculas que no mandan salto de línea: se interpreta el búfer al vuelo.
        if (buffer.length > 32) {
          const kg = parseScaleLine(buffer);
          if (kg != null) pushReading(kg);
          buffer = "";
        }
      }
    } catch (err) {
      emit({ status: "error", error: err instanceof Error ? err.message : "Se perdió la conexión con la báscula" });
      break;
    } finally {
      reader?.releaseLock();
      reader = null;
    }
  }
}

async function openPort(p: SerialPortLike) {
  emit({ status: "connecting", error: null });
  try {
    await p.open({ baudRate: state.config.baudRate });
    port = p;
    emit({ status: "connected", kg: null, stable: false });
    void readLoop(p);
    if (state.config.command) {
      const encoder = new TextEncoder();
      pollTimer = setInterval(async () => {
        const w = port?.writable?.getWriter();
        if (!w) return;
        try {
          await w.write(encoder.encode(state.config.command));
        } finally {
          w.releaseLock();
        }
      }, Math.max(150, state.config.intervalMs));
    }
  } catch (err) {
    port = null;
    emit({ status: "error", error: err instanceof Error ? err.message : "No se pudo abrir el puerto" });
  }
}

export const scale = {
  subscribe(listener: () => void) {
    init();
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => state,
  async connect() {
    const s = serial();
    if (!s) {
      emit({ status: "unsupported" });
      return;
    }
    await scale.disconnect();
    try {
      const p = await s.requestPort();
      await openPort(p);
    } catch (err) {
      // Cerrar el selector sin elegir puerto no es un error.
      if (err instanceof Error && err.name === "NotFoundError") emit({ status: "disconnected" });
      else emit({ status: "error", error: err instanceof Error ? err.message : "No se pudo conectar" });
    }
  },
  async disconnect() {
    if (pollTimer) clearInterval(pollTimer);
    if (demoTimer) clearInterval(demoTimer);
    pollTimer = demoTimer = null;
    const p = port;
    port = null;
    try {
      await reader?.cancel();
    } catch {
      /* ya cerrado */
    }
    try {
      await p?.close();
    } catch {
      /* ya cerrado */
    }
    emit({ status: serial() ? "disconnected" : "unsupported", kg: null, stable: false, error: null });
  },
  /** Báscula simulada para capacitar o probar sin equipo: el peso cambia solo. */
  async demo() {
    await scale.disconnect();
    emit({ status: "demo", kg: 0, stable: false });
    const targets = [0.5, 1.25, 0.875, 2.1, 0.34];
    let i = 0;
    let current = 0;
    demoTimer = setInterval(() => {
      const target = targets[Math.floor(i / 28) % targets.length];
      current += (target - current) * 0.45;
      if (Math.abs(target - current) < 0.003) current = target;
      pushReading(Math.round(current * 1000) / 1000);
      i++;
    }, 160);
  },
  setConfig(config: Partial<ScaleConfig>) {
    const next = { ...state.config, ...config };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* sin almacenamiento */
    }
    emit({ config: next });
  },
};

const serverState: ScaleState = { status: "disconnected", kg: null, stable: false, error: null, config: DEFAULT_CONFIG };

export function useScale(): ScaleState {
  return useSyncExternalStore(scale.subscribe, scale.get, () => serverState);
}

/** Convierte kg a la unidad de venta del producto; null si la unidad no es de peso. */
export function kgToUnit(kg: number, unitAbbrev: string): number | null {
  const u = unitAbbrev.trim().toLowerCase();
  if (u === "kg" || u === "kilo" || u === "kilos") return kg;
  if (u === "g" || u === "gr" || u === "grs") return Math.round(kg * 1000);
  if (u === "lb" || u === "lbs") return Math.round((kg / 0.45359237) * 1000) / 1000;
  if (u === "oz") return Math.round((kg / 0.028349523) * 100) / 100;
  return null;
}
