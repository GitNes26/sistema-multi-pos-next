import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Armchair } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { TablesManager } from "@/components/admin/tables/tables-manager";

export const metadata: Metadata = { title: "Mesas" };

export default async function TablesPage() {
  // El mapa de mesas se lee con locations.view (nav), pero crear/renombrar/
  // eliminar exige locations.manage: se resuelve en servidor y se pasa al
  // cliente para ocultar los controles, espejo del split de /api/tables.
  const session = await getServerSession(authOptions);
  const canManageTables = hasPermission(session, "locations.manage");

  return (
    <div className="w-full">
      <PageHeader
        icon={<Armchair className="size-5" />}
        title="Mesas"
        description="Administra las mesas de tu restaurante o negocio."
      />
      <TablesManager canManage={canManageTables} />
    </div>
  );
}
