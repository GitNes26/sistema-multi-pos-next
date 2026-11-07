import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { hasPermission } from "@/lib/auth/permissions";
import type { PermissionKey } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db";
import { AgendaError, AGENDA_MODES } from "@/lib/agenda/server";
import { PolicyError } from "@/lib/agenda/policy";

export type AgendaSession = Session;

/**
 * Guard de la agenda: sesión de app con organización y modo services/hybrid.
 * Exige SIEMPRE appointments.view (permiso de modo); `permission` (opcional)
 * refuerza el permiso puntual para las rutas de escritura (manage).
 */
export async function requireAgendaSession(
  permission?: PermissionKey
): Promise<{ session: AgendaSession; organizationId: string } | { response: NextResponse }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { response: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 }) };
  }
  const organizationId = effectiveOrgId(session);
  if (!organizationId || session.user.scope === "portal") {
    return { response: NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 }) };
  }
  // La API de la agenda exige SIEMPRE su permiso de modo (igual que pos.use en
  // la API del POS): sin appointments.view no se toca ningún endpoint, aunque
  // una ruta futura olvide pedirlo. Las rutas de escritura refuerzan además
  // appointments.manage con el parámetro `permission`.
  if (!hasPermission(session, "appointments.view")) {
    return {
      response: NextResponse.json(
        { ok: false, error: "Permiso requerido: appointments.view" },
        { status: 403 }
      ),
    };
  }
  if (
    permission &&
    permission !== "appointments.view" &&
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
  if (!AGENDA_MODES.includes(org.businessMode)) {
    return {
      response: NextResponse.json(
        { ok: false, error: "La agenda no aplica a tu tipo de negocio" },
        { status: 403 }
      ),
    };
  }

  return { session, organizationId };
}

/**
 * Saltarse la política (tiempo mínimo, límite de reagendas, tolerancia) exige el permiso
 * appointments.override y un motivo; sin él se rechaza aunque el motivo venga escrito.
 */
export function overrideFromBody(session: AgendaSession, body: { overrideReason?: unknown } | null | undefined): { reason: string } | null {
  const reason = typeof body?.overrideReason === "string" ? body.overrideReason.trim().slice(0, 190) : "";
  if (!reason) return null;
  if (!hasPermission(session, "appointments.override")) {
    throw new AgendaError("Necesitas autorización de un responsable para saltarte la política de citas", 403);
  }
  return { reason };
}

export function agendaErrorResponse(err: unknown): NextResponse {
  if (err instanceof AgendaError) {
    return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
  }
  if (err instanceof PolicyError) {
    return NextResponse.json({ ok: false, error: err.message, code: err.code, overridable: err.overridable }, { status: 409 });
  }
  console.error("[agenda]", err);
  return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
}

export async function resolveAgendaEmployeeId(userId: string, organizationId: string) {
  const emp = await prisma.employee.findFirst({
    where: { organizationId, userId },
    select: { id: true },
  });
  return emp?.id ?? null;
}