import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Truck } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { PurchasingPage } from "@/components/admin/purchasing/purchasing-page";

export const metadata: Metadata = { title: "Proveedores y compras" };

export default async function Page() {
  const session = await getServerSession(authOptions);
  return <PurchasingPage icon={<Truck className="size-5" />} canManage={hasPermission(session, "purchasing.manage")} canApprove={hasPermission(session, "purchasing.approve")} canReceive={hasPermission(session, "purchasing.receive")} />;
}
