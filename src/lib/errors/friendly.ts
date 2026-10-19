import { randomBytes } from "node:crypto"

// Errores del servidor explicados en lenguaje de persona: qué pasó, si se perdió
// algo y qué hacer. El código de soporte permite ubicar el detalle en los logs
// sin mostrarle datos técnicos al usuario.

export interface FriendlyError {
  message: string
  status: number
  code: string
}

export function supportCode(): string {
  return `E-${randomBytes(3).toString("hex").toUpperCase()}`
}

function prismaCode(err: unknown): string | null {
  const code = (err as { code?: unknown } | null)?.code
  return typeof code === "string" && /^P\d{4}$/.test(code) ? code : null
}

/**
 * @param what acción en infinitivo, p. ej. "guardar la venta".
 * @param safety frase sobre lo que NO se perdió, p. ej. "Tu ticket sigue aquí y no se cobró nada."
 */
export function friendlyServerError(err: unknown, what: string, safety: string): FriendlyError {
  const code = supportCode()
  const prisma = prismaCode(err)
  if (prisma === "P1001" || prisma === "P1002" || prisma === "P1017" || prisma === "P2024") {
    return { status: 503, code, message: `No pudimos ${what} porque el sistema tardó en responder. ${safety} Espera unos segundos y reintenta. (Código de soporte ${code})` }
  }
  if (prisma === "P2034") {
    return { status: 409, code, message: `Otra operación se estaba guardando al mismo tiempo y no pudimos ${what}. ${safety} Reintenta. (Código de soporte ${code})` }
  }
  if (prisma === "P2002") {
    return { status: 409, code, message: `No pudimos ${what} porque ese registro ya existe. ${safety} Revisa si ya lo habías guardado. (Código de soporte ${code})` }
  }
  if (prisma === "P2003" || prisma === "P2025") {
    return { status: 409, code, message: `No pudimos ${what} porque algo del ticket cambió (un producto, cliente o caja ya no existe). ${safety} Actualiza la pantalla y reintenta. (Código de soporte ${code})` }
  }
  return { status: 500, code, message: `No pudimos ${what}. ${safety} Reintenta; si vuelve a pasar, danos este código de soporte: ${code}.` }
}
