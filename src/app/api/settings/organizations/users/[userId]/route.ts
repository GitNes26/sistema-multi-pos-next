import { NextResponse } from "next/server";
import { updateUserAccount, UserAccountError } from "@/lib/settings/user-account";
import { superadminGuard, settingsErrorResponse } from "../../../guard";

// Superadmin: editar nombre, correo, teléfono y contraseña de cualquier usuario.

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const guard = await superadminGuard();
  if ("response" in guard) return guard.response;
  const { userId } = await params;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const result = await updateUserAccount({
      userId,
      scopeOrganizationId: null,
      actorUserId: guard.session.user.id ?? null,
      input: {
        fullName: typeof body.fullName === "string" ? body.fullName : undefined,
        email: typeof body.email === "string" ? body.email : undefined,
        phone: typeof body.phone === "string" ? body.phone : undefined,
        password: typeof body.password === "string" && body.password ? body.password : undefined,
      },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof UserAccountError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    return settingsErrorResponse(err);
  }
}
