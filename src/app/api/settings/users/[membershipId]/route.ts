import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateMembershipRole, setUserActive, removeMembership } from "@/lib/settings/server";
import { usersManageGuard, settingsErrorResponse } from "../../guard";
import { updateUserAccount, UserAccountError } from "@/lib/settings/user-account";

// FASE 15.4 — Cambiar rol / estado de un miembro (PATCH) o quitarlo (DELETE).

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const guard = await usersManageGuard();
  if ("response" in guard) return guard.response;

  const { membershipId } = await params;
  try {
    const body = await req.json();

    if (body.roleId) {
      await updateMembershipRole(membershipId, undefined, body.roleId, guard.organizationId);
    } else if (body.role) {
      await updateMembershipRole(membershipId, body.role, undefined, guard.organizationId);
    }
    if (typeof body.isActive === "boolean") {
      const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
      // Solo miembros de la empresa activa (un id adivinado de otra empresa no se toca).
      if (membership && membership.organizationId === guard.organizationId) await setUserActive(membership.userId, body.isActive);
    }
    // Datos del usuario: nombre, correo, teléfono y contraseña.
    if (body.profile && typeof body.profile === "object") {
      const membership = await prisma.membership.findUnique({ where: { id: membershipId }, select: { userId: true, organizationId: true } });
      if (!membership || membership.organizationId !== guard.organizationId) throw new UserAccountError("Usuario no encontrado", 404);
      const profile = body.profile as Record<string, unknown>;
      const result = await updateUserAccount({
        userId: membership.userId,
        scopeOrganizationId: guard.organizationId,
        actorUserId: guard.session.user.id ?? null,
        input: {
          fullName: typeof profile.fullName === "string" ? profile.fullName : undefined,
          email: typeof profile.email === "string" ? profile.email : undefined,
          phone: typeof profile.phone === "string" ? profile.phone : undefined,
          password: typeof profile.password === "string" && profile.password ? profile.password : undefined,
        },
      });
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UserAccountError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    return settingsErrorResponse(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const guard = await usersManageGuard();
  if ("response" in guard) return guard.response;

  const { membershipId } = await params;
  try {
    const result = await removeMembership(membershipId, guard.organizationId);
    return NextResponse.json(result);
  } catch (err) {
    return settingsErrorResponse(err);
  }
}
