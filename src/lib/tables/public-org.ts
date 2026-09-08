import { prisma } from "@/lib/db";

// Resolución de organización para rutas públicas (sin sesión): por `?org=` o
// por el par mesa+token del QR (`?table=&token=`), igual que el menú digital.
// Compartida por /api/public/reservations y /api/public/waitlist.

export type OrgCtx = { organizationId: string; locationId: string | null };

/** Resuelve la organización de la solicitud (org directa o QR de mesa). */
export async function resolvePublicOrg(url: URL): Promise<OrgCtx | { error: string; status: number }> {
  const orgId = url.searchParams.get("org");
  if (orgId) {
    const org = await prisma.organization.findFirst({
      where: { id: orgId },
      select: { id: true },
    });
    if (!org) return { error: "Organización no encontrada", status: 404 };
    return { organizationId: org.id, locationId: null };
  }

  const tableId = url.searchParams.get("table");
  const tableToken = url.searchParams.get("token");
  if (tableId) {
    if (!tableToken) {
      return { error: "Token de mesa requerido: escanea el QR de tu mesa", status: 400 };
    }
    const table = await prisma.table.findFirst({
      where: { id: tableId, qrToken: tableToken, isActive: true },
      select: { id: true, organizationId: true, locationId: true },
    });
    if (!table) return { error: "QR de mesa inválido", status: 400 };
    return { organizationId: table.organizationId, locationId: table.locationId };
  }

  return { error: "Organización requerida (?org= o ?table=&token=)", status: 400 };
}
