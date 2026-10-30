import { prisma } from "@/lib/db"

// Retención de notificaciones: se genera una fila por venta/pedido, así que sin purga la tabla crece
// sin límite. Las leídas ya no sirven pronto; las no leídas se conservan más tiempo por si alguien
// regresa de vacaciones.
const DAY_MS = 86_400_000
const BATCH = 5_000
const MAX_BATCHES = 200

const days = (name: string, fallback: number) => {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n >= 1 ? n : fallback
}

export const NOTIFICATION_READ_DAYS = () => days("NOTIFICATIONS_READ_DAYS", 60)
export const NOTIFICATION_UNREAD_DAYS = () => days("NOTIFICATIONS_UNREAD_DAYS", 180)

/** Borra en lotes (no bloquea la tabla) y devuelve cuántas filas eliminó. */
export async function purgeNotifications(now = new Date()) {
  const readCutoff = new Date(now.getTime() - NOTIFICATION_READ_DAYS() * DAY_MS)
  const unreadCutoff = new Date(now.getTime() - NOTIFICATION_UNREAD_DAYS() * DAY_MS)
  let read = 0
  let unread = 0
  for (let i = 0; i < MAX_BATCHES; i += 1) {
    const n = Number(await prisma.$executeRaw`DELETE FROM notifications WHERE readAt IS NOT NULL AND createdAt < ${readCutoff} LIMIT ${BATCH}`)
    read += n
    if (n < BATCH) break
  }
  for (let i = 0; i < MAX_BATCHES; i += 1) {
    const n = Number(await prisma.$executeRaw`DELETE FROM notifications WHERE createdAt < ${unreadCutoff} LIMIT ${BATCH}`)
    unread += n
    if (n < BATCH) break
  }
  return { read, unread }
}
