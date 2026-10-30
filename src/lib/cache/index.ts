// Caché de lecturas repetidas (catálogo del POS, planes, menús, ajustes de la empresa).
//
// Qué hace:
//  - TTL por clave y límite de entradas (LRU): la memoria no crece sin control.
//  - Una sola carga a la vez por clave (single-flight): si 500 cajas piden lo mismo en el
//    mismo instante, la base de datos recibe UNA consulta, no 500.
//  - Stale-while-revalidate: pasado el TTL se sigue sirviendo el dato anterior unos segundos
//    mientras uno solo lo recarga en segundo plano; nadie espera por el refresco.
//  - Invalidación por etiqueta (`org:<id>`): al cambiar productos, clientes o promociones se
//    descarta lo de esa empresa sin tocar a las demás.
//
// Alcance: memoria de este proceso. Con varias instancias, la invalidación llega solo a la
// instancia que recibió el cambio; las demás se actualizan al vencer el TTL (por eso los TTL son
// cortos: 15–60 s). Para invalidación entre instancias, implementar `CacheDriver` con Redis y
// asignarlo con `setCacheDriver` (ver docs/agents/ESCALABILIDAD.md).

export interface CacheOptions {
  /** Vida del dato fresco, en milisegundos. */
  ttlMs: number
  /** Tiempo extra en que se sirve el dato vencido mientras se recarga (por defecto 2 × ttl). */
  staleMs?: number
  /** Etiquetas para invalidar en grupo, p. ej. `org:<id>`. */
  tags?: string[]
}

export interface CacheDriver {
  get(key: string): { value: unknown; freshUntil: number; staleUntil: number } | undefined
  set(key: string, value: unknown, freshUntil: number, staleUntil: number, tags: string[]): void
  deleteTag(tag: string): number
  clear(): void
  size(): number
}

class MemoryDriver implements CacheDriver {
  private entries = new Map<string, { value: unknown; freshUntil: number; staleUntil: number; tags: string[] }>()
  private byTag = new Map<string, Set<string>>()

  constructor(private readonly max: number) {}

  get(key: string) {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    // LRU: lo recién leído pasa al final.
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry
  }

  set(key: string, value: unknown, freshUntil: number, staleUntil: number, tags: string[]) {
    this.drop(key)
    this.entries.set(key, { value, freshUntil, staleUntil, tags })
    for (const tag of tags) {
      const keys = this.byTag.get(tag) ?? new Set<string>()
      keys.add(key)
      this.byTag.set(tag, keys)
    }
    while (this.entries.size > this.max) {
      const oldest = this.entries.keys().next().value as string | undefined
      if (oldest === undefined) break
      this.drop(oldest)
    }
  }

  private drop(key: string) {
    const entry = this.entries.get(key)
    if (!entry) return
    this.entries.delete(key)
    for (const tag of entry.tags) {
      const keys = this.byTag.get(tag)
      keys?.delete(key)
      if (keys?.size === 0) this.byTag.delete(tag)
    }
  }

  deleteTag(tag: string) {
    const keys = [...(this.byTag.get(tag) ?? [])]
    for (const key of keys) this.drop(key)
    return keys.length
  }

  clear() {
    this.entries.clear()
    this.byTag.clear()
  }

  size() {
    return this.entries.size
  }
}

interface CacheState {
  driver: CacheDriver
  inflight: Map<string, Promise<unknown>>
  /** Generación por etiqueta: una carga iniciada antes de invalidar no debe guardarse después. */
  generation: Map<string, number>
  hits: number
  stale: number
  misses: number
  coalesced: number
  invalidations: number
}

// Singleton en globalThis: en desarrollo cada ruta evalúa sus módulos por separado.
const g = globalThis as unknown as { __mpCache?: CacheState }
const state: CacheState = (g.__mpCache ??= {
  driver: new MemoryDriver(Number(process.env.CACHE_MAX_ENTRIES) || 3000),
  inflight: new Map(),
  generation: new Map(),
  hits: 0,
  stale: 0,
  misses: 0,
  coalesced: 0,
  invalidations: 0,
})

const DISABLED = process.env.CACHE_DISABLED === "1"

export function setCacheDriver(driver: CacheDriver) {
  state.driver = driver
}

const generationOf = (tags: string[]) => tags.reduce((sum, tag) => sum + (state.generation.get(tag) ?? 0), 0)

async function load<T>(key: string, opts: CacheOptions, loader: () => Promise<T>): Promise<T> {
  const tags = opts.tags ?? []
  const running = state.inflight.get(key) as Promise<T> | undefined
  if (running) {
    state.coalesced += 1
    return running
  }
  const before = generationOf(tags)
  const promise = (async () => {
    try {
      const value = await loader()
      // Si algo se invalidó mientras cargaba, el dato puede estar viejo: se entrega pero no se guarda.
      if (generationOf(tags) === before) {
        const now = Date.now()
        state.driver.set(key, value, now + opts.ttlMs, now + opts.ttlMs + (opts.staleMs ?? opts.ttlMs * 2), tags)
      }
      return value
    } finally {
      state.inflight.delete(key)
    }
  })()
  state.inflight.set(key, promise)
  return promise
}

/** Devuelve el dato en caché o lo carga una sola vez. Un error del loader nunca se guarda. */
export async function cached<T>(key: string, opts: CacheOptions, loader: () => Promise<T>): Promise<T> {
  if (DISABLED || opts.ttlMs <= 0) return loader()
  const now = Date.now()
  const hit = state.driver.get(key)
  if (hit && now < hit.freshUntil) {
    state.hits += 1
    return hit.value as T
  }
  if (hit && now < hit.staleUntil) {
    // Dato vencido pero aceptable: se sirve ya y uno solo lo refresca en segundo plano.
    state.stale += 1
    if (!state.inflight.has(key)) void load(key, opts, loader).catch(() => undefined)
    return hit.value as T
  }
  state.misses += 1
  return load(key, opts, loader)
}

/** Descarta todo lo guardado con esa etiqueta. */
export function invalidateTag(tag: string): number {
  state.generation.set(tag, (state.generation.get(tag) ?? 0) + 1)
  state.invalidations += 1
  return state.driver.deleteTag(tag)
}

export const orgTag = (organizationId: string) => `org:${organizationId}`

/** Descarta el caché de una empresa (productos, clientes, promociones, ajustes…). */
export const invalidateOrg = (organizationId: string) => invalidateTag(orgTag(organizationId))

export function clearCache() {
  state.driver.clear()
  state.inflight.clear()
}

export function cacheStats() {
  const reads = state.hits + state.stale + state.misses
  return {
    entries: state.driver.size(),
    hits: state.hits,
    stale: state.stale,
    misses: state.misses,
    coalesced: state.coalesced,
    invalidations: state.invalidations,
    hitRate: reads ? Number(((state.hits + state.stale) / reads).toFixed(3)) : 0,
  }
}
