import { NextResponse } from "next/server";
import { issuePasswordResetToken } from "@/lib/auth/users";
import { mailConfigured, sendOrganizationWelcomeLink, sendPasswordLink } from "@/lib/auth/mail";
import { prisma } from "@/lib/db";

// Solicitud de recuperación; en desarrollo sin SMTP se ofrece un enlace local.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim();

  if (!email) {
    return NextResponse.json({ error: "Correo requerido" }, { status: 400 });
  }

  const isDev = process.env.NODE_ENV === "development";
  if (!mailConfigured() && !isDev) {
    console.error("[auth/forgot] SMTP no configurado");
    return NextResponse.json({ error: "El correo de recuperación no está configurado." }, { status: 503 });
  }
  const { token, sent } = await issuePasswordResetToken(email);

  if (!sent) {
    // No revelar si el correo existe.
    return NextResponse.json({ sent: true, devResetUrl: null });
  }

  if (token && mailConfigured()) {
    try {
      const account = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { fullName: true, activationRequired: true, customers: { take: 1, select: { organizationId: true } }, employees: { take: 1, select: { organizationId: true, location: { select: { name: true } } } }, memberships: { take: 1, select: { organizationId: true, role: true } } },
      });
      if (account?.activationRequired) {
        const organizationId = account.customers[0]?.organizationId ?? account.employees[0]?.organizationId ?? account.memberships[0]?.organizationId;
        const accountType = account.customers.length ? "cliente" : account.employees.length ? "empleado" : "propietario";
        if (organizationId) await sendOrganizationWelcomeLink(email, organizationId, { fullName: account.fullName, accountType, locationName: account.employees[0]?.location?.name });
        else await sendPasswordLink(email, token, "welcome", { fullName: account.fullName, accountType });
      } else {
        await sendPasswordLink(email, token, "reset");
      }
    } catch (error) {
      console.error("[auth/forgot] Falló el envío de correo:", error);
      // Misma respuesta para cuentas existentes e inexistentes.
      return NextResponse.json({ sent: true, devResetUrl: null });
    }
  }
  const devResetUrl = isDev && !mailConfigured() && token ? `/auth/reset?token=${token}` : null;
  return NextResponse.json({ sent: true, devResetUrl });
}
