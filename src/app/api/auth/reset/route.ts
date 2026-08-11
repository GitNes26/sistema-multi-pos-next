import { NextResponse } from "next/server";
import { applyPasswordResetToken } from "@/lib/auth/users";

// FASE 2.5 — Aplicar token de reset y nueva contraseña.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { token?: string; password?: string }
    | null;

  const token = body?.token?.trim();
  const password = body?.password;

  if (!token || !password || password.length < 6) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const result = await applyPasswordResetToken(token, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}