"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { hasPermission } from "@/lib/auth/permissions";
import { KitchenDisplay } from "@/components/kds/kitchen-display";
import { DeliveriesBoard } from "@/components/kds/deliveries-board";
import { LiveBadge } from "@/components/shared/live-badge";
import { BusinessModeBadge } from "@/components/shared/business-mode-badge";
import { Button } from "@/components/ui/button";

export default function KDSPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const canManageDeliveries = hasPermission(session, "delivery.manage");

  const orgName = session?.user?.organizationName ?? null;
  const orgMode = session?.user?.businessMode ?? null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push("/pos");
              }
            }}
          >
            <ArrowLeft className="size-4" />
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
