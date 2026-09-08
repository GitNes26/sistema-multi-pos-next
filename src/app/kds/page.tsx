import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { KitchenDisplay } from "@/components/kds/kitchen-display";
import { DeliveriesBoard } from "@/components/kds/deliveries-board";
import { LiveBadge } from "@/components/shared/live-badge";
import { BusinessModeBadge } from "@/components/shared/business-mode-badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "KDS - Cocina" };

export default async function KDSPage() {
  const session = await getServerSession(authOptions);
  const canManageDeliveries = hasPermission(session, "delivery.manage");

  const orgName = session?.user?.organizationName ?? null;
  const orgMode = session?.user?.businessMode ?? null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm" className="shrink-0">
            <Link href="/pos">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <Building2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-semibold">
            {orgName ?? "Organización"}
          </span>
          {orgMode ? (
            <BusinessModeBadge
              mode={orgMode}
              className="hidden shrink-0 sm:inline-flex"
              labelClassName="hidden max-w-28 lg:inline"
            />
          ) : null}
        </div>
        <LiveBadge />
      </div>
      {canManageDeliveries && (
        <div className="mb-6">
          <DeliveriesBoard />
        </div>
      )}
      <KitchenDisplay />
    </div>
  );
}
