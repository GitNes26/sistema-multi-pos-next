import { NextResponse } from "next/server";
import { issuePasswordResetToken } from "@/lib/auth/users";

// FASE 2.5 — Solicitud de reset de contraseña.
// En desarrollo devolvemos el enlace (no hay servicio de correo configurado).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim();

  if (!email) {
    return NextResponse.json({ error: "Correo requerido" }, { status: 400 });
  }

  const isDev = process.env.NODE_ENV === "development";
  const { token, sent } = await issuePasswordResetToken(email);

  if (!sent) {
    // No revelar si el correo existe.
    return NextResponse.json({ sent: true, devResetUrl: null });
  }

  const devResetUrl = isDev && token ? `/auth/reset?token=${token}` : null;
  return NextResponse.json({ sent: true, devResetUrl });
}