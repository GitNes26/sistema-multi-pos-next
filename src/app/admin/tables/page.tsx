import type { Metadata } from "next";
import { Armchair } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { TablesManager } from "@/components/admin/tables/tables-manager";

export const metadata: Metadata = { title: "Mesas" };

export default function TablesPage() {
  return (
    <div className="w-full">
      <PageHeader
        icon={<Armchair className="size-5" />}
        title="Mesas"
        description="Administra las mesas de tu restaurante o negocio."
      />
      <TablesManager />
    </div>
  );
}
