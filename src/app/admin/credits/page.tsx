import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Landmark } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { isSuperadminSession } from "@/lib/auth/org-context";
import { PageHeader } from "@/components/layout/page-header";
import { CreditsManager } from "@/components/admin/credits/credits-manager";

export const metadata: Metadata = { title: "Crédito / Cuentas por cobrar" };

export default async function AdminCreditsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.scope === "portal") {
    redirect("/admin");
  }

  const isSuper = isSuperadminSession(session);
  const canView = isSuper || hasPermission(session, "orders.view");

  if (!canView) {
    redirect("/admin");
  }

  return (
    <div className="w-full space-y-4">
      <PageHeader
        icon={<Landmark className="size-5" />}
        title="Crédito / Cuentas por cobrar"
        description={isSuper ? "Gestiona las cuentas de crédito de todas las organizaciones." : "Gestiona las cuentas de crédito de tus clientes."}
      />
      <CreditsManager isSuperadmin={isSuper} />
    </div>
  );
}
