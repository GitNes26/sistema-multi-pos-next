// Uso del menú lateral: qué pantallas visita cada persona y con qué frecuencia.
// Con eso, el menú reducido muestra siempre las más utilizadas y se va ajustando
// solo cuando cambian los hábitos (las visitas viejas pierden peso con el tiempo).

export type NavUsageEntry = { s: number; t: number };
export type NavUsageStore = Record<string, NavUsageEntry>;

/** Pantallas frecuentes que se muestran además del Panel (que siempre está). */
export const FREQUENT_LIMIT = 4;
/** Cada cuántos días una visita pesa la mitad. */
export const HALF_LIFE_DAYS = 14;
const MAX_ENTRIES = 60;
const DAY = 86_400_000;

/** Orden con el que arranca el menú cuando todavía no hay historial. */
export const DEFAULT_FREQUENT = ["/pos", "/admin/products", "/admin/inventory", "/admin/sales", "/admin/orders", "/admin/customers"];

export const scoreOf = (entry: NavUsageEntry | undefined, now: number): number =>
  entry ? entry.s * Math.pow(0.5, Math.max(0, now - entry.t) / (HALF_LIFE_DAYS * DAY)) : 0;

/** Suma una visita a `key` (devuelve un almacén nuevo, sin modificar el anterior). */
export function recordVisit(store: NavUsageStore, key: string, now: number): NavUsageStore {
  const next: NavUsageStore = { ...store, [key]: { s: scoreOf(store[key], now) + 1, t: now } };
  const keys = Object.keys(next);
  if (keys.length <= MAX_ENTRIES) return next;
  keys.sort((a, b) => scoreOf(next[a], now) - scoreOf(next[b], now));
  for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete next[k];
  return next;
}

/**
 * Las `limit` pantallas más usadas entre `keys`. Sin historial gana el orden por defecto;
 * una pantalla con visitas reales siempre supera a una sugerida por defecto.
 */
export function pickFrequent(keys: string[], store: NavUsageStore, now: number, limit = FREQUENT_LIMIT, defaults = DEFAULT_FREQUENT): Set<string> {
  const rank = (key: string) => {
    const d = defaults.indexOf(key);
    // Un bono pequeño por orden por defecto: desempata y llena el menú de quien apenas empieza.
    return scoreOf(store[key], now) + (d >= 0 ? (defaults.length - d) * 0.001 : 0);
  };
  return new Set(
    keys
      .map((key, i) => ({ key, i, r: rank(key) }))
      .sort((a, b) => b.r - a.r || a.i - b.i)
      .slice(0, limit)
      .map((x) => x.key)
  );
}
