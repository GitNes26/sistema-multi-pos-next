import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { SupervisorForm } from "@/components/admin/settings/supervisor-form";

export const metadata: Metadata = { title: "Aprobación de supervisor" };

// FASE 15.7 — Configuración de aprobación de supervisor.

export default async function SupervisorSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "settings.manage")) {
    redirect("/admin");
  }

  return (
    <div className="w-full">
      <PageHeader
        icon={<ShieldCheck className="size-5" />}
        title="Aprobación de supervisor"
        description="Elige qué acciones requieren la clave de un supervisor."
      />
      <SupervisorForm />
    </div>
  );
}
