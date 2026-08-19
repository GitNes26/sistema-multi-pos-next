import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { OrganizationsManager } from "@/components/admin/settings/organizations-manager";

export const metadata: Metadata = { title: "Organizaciones y roles" };

// FASE 15.9 — Gestión global de organizaciones y asignación de admins.
// Exclusivo del superAdmin (permiso reservado organizations.manage).

export default async function OrganizationsSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "organizations.manage")) {
    redirect("/admin");
  }

  return (
    <div className="w-full">
      <PageHeader
        icon={<Building2 className="size-5" />}
        title="Organizaciones y roles"
        description="Crea empresas, asigna owners y administra qué usuarios (admin) las controlan."
      />
      <OrganizationsManager />
    </div>
  );
}