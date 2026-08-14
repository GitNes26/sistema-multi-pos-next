import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Menu } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { MenusManager } from "@/components/admin/settings/menus-manager";

export const metadata: Metadata = { title: "Gestión de menú" };

// FASE 14.6 — CRUD del menú dinámico (desde admin).

export default async function AdminMenusPage() {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "users.manage")) {
    redirect("/admin");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        icon={<Menu className="size-5" />}
        title="Gestión de menú"
        description="Organiza secciones e ítems del menú lateral y la barra inferior."
      />
      <MenusManager />
    </div>
  );
}
