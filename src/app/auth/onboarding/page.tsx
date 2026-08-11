import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Configura tu cuenta" };

// FASE 2.11 — Onboarding para nuevos owners. Sin registro público (las altas
// llegan por WhatsApp), este flujo se detona al crear una organización nueva.
export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login");

  const memberships = await prisma.membership.count({
    where: { userId: session.user.id },
  });

  if (memberships > 0) redirect("/admin");

  return (
    <AuthShell>
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-lg">Bienvenido a Multi-POS</CardTitle>
          <CardDescription>
            Aún no perteneces a una organización. Cuando tu empresa active tu cuenta, podrás
            acceder al panel desde el menú principal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground">
            El asistente de configuración inicial (primera sucursal, caja y empleados) se
            implementa aquí en pasos posteriores.
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}