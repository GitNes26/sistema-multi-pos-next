import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Users } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/layout/page-header";
import { UsersManager } from "@/components/admin/settings/users-manager";

export const metadata: Metadata = { title: "Usuarios y permisos" };

// FASE 15.4/15.5 — Usuarios, roles y permisos, e invitaciones.

export default async function UsersSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "users.manage")) return <AccessDenied permission="users.manage" />

  return (
    <div className="w-full">
      <PageHeader
        icon={<Users className="size-5" />}
        title="Usuarios y permisos"
        description="Gestiona miembros, roles, permisos e invitaciones."
      />
      <UsersManager isSuperadmin={session?.user?.role === "superadmin"} />
    </div>
  );
}
