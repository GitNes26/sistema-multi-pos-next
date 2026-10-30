import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma abre por defecto `núcleos × 2 + 1` conexiones (9 en un equipo de 4 núcleos). Con cientos
 * de usuarios a la vez eso se agota y las peticiones esperan en fila hasta fallar con
 * "Timed out fetching a new connection". El tamaño se fija aquí con DB_POOL_SIZE (por defecto 25)
 * y DB_POOL_TIMEOUT (segundos, por defecto 20), salvo que la URL ya los traiga.
 *
 * Regla para dimensionar: instancias × DB_POOL_SIZE debe quedar por debajo de `max_connections`
 * de MySQL (151 por defecto), dejando margen para migraciones y herramientas.
 */
export function databaseUrlWithPool(raw: string | undefined, env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", String(Number(env.DB_POOL_SIZE) || 25));
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", String(Number(env.DB_POOL_TIMEOUT) || 20));
    return url.toString();
  } catch {
    return raw;
  }
}

const url = databaseUrlWithPool(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(url ? { datasourceUrl: url } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
