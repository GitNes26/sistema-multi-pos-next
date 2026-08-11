import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { changePassword } from "@/lib/auth/users";

// FASE 2.13 — Cambio de contraseña (sesión obligatoria).
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { oldPassword?: string; newPassword?: string }
    | null;

  const oldPassword = body?.oldPassword;
  const newPassword = body?.newPassword;

  if (!oldPassword || !newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: "Datos incompletos o contraseña muy corta" }, { status: 400 });
  }
  if (oldPassword === newPassword) {
    return NextResponse.json({ error: "La nueva contraseña debe ser diferente" }, { status: 400 });
  }

  const result = await changePassword(session.user.id, oldPassword, newPassword);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "No se pudo cambiar" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}