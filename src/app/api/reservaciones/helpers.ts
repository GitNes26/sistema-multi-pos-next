import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { hasPermission } from "@/lib/auth/permissions";
import type { PermissionKey } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db";
import { ReservationError, RESERVATION_MODES } from "@/lib/reservations/server";

export type ReservationSession = Session;

/**
 * Guard de reservaciones: sesión de app con organización y modo rental/hybrid.
 * Exige SIEMPRE reservations.view (permiso de modo); `permission` (opcional)
 * refuerza el permiso puntual para las rutas de escritura (manage).
 */
export async function requireReservationsSession(
  permission?: PermissionKey
): Promise<{ session: ReservationSession; organizationId: string } | { response: NextResponse }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { response: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 }) };
  }
  const organizationId = effectiveOrgId(session);
  if (!organizationId || session.user.scope === "portal") {
    return { response: NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 }) };
  }
  // La API de reservaciones exige SIEMPRE su permiso de modo (igual que pos.use
  // en la API del POS): sin reservations.view no se toca ningún endpoint,
  // aunque una ruta futura olvide pedirlo. Las rutas de escritura refuerzan
  // además reservations.manage con el parámetro `permission`.
  if (!hasPermission(session, "reservations.view")) {
    return {
      response: NextResponse.json(
        { ok: false, error: "Permiso requerido: reservations.view" },
        { status: 403 }
      ),
    };
  }
  if (
    permission &&
    permission !== "reservations.view" &&
    !hasPermission(session, permission)
  ) {
    return {
      response: NextResponse.json(
        { ok: false, error: "Permiso requerido: " + permission },
        { status: 403 }
      ),
    };
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { businessMode: true },
  });
  if (!org) {
    return { response: NextResponse.json({ ok: false, error: "Organización no encontrada" }, { status: 404 }) };
  }
  if (!RESERVATION_MODES.includes(org.businessMode)) {
    return {
      response: NextResponse.json(
        { ok: false, error: "Las reservaciones no aplican a tu tipo de negocio" },
        { status: 403 }
      ),
    };
  }

  return { session, organizationId };
}

export function reservationErrorResponse(err: unknown): NextResponse {
  if (err instanceof ReservationError) {
    return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
  }
  console.error("[reservaciones]", err);
  return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
}

export async function resolveReservationEmployeeId(userId: string, organizationId: string) {
  const emp = await prisma.employee.findFirst({
    where: { organizationId, userId },
    select: { id: true },
  });
  return emp?.id ?? null;
}