"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import type { BusinessMode } from "@/lib/auth/options";

type OrganizationContextSyncProps = {
  organizationId: string | null;
  organizationName: string | null;
  businessMode: BusinessMode | null;
};

/**
 * Reconciles the device-local JWT with the current organization row. A business
 * mode change must be visible to every active device without signing out first.
 */
export function OrganizationContextSync({
  organizationId,
  organizationName,
  businessMode,
}: OrganizationContextSyncProps) {
  const { data: session, update, status } = useSession();
  const requestedRef = useRef("");

  useEffect(() => {
    if (status !== "authenticated" || !session?.user || !organizationId || !businessMode) return;

    const currentId = session.user.activeOrganizationId ?? session.user.organizationId ?? null;
    const fingerprint = `${organizationId}:${businessMode}:${organizationName ?? ""}`;
    const isCurrent =
      currentId === organizationId &&
      session.user.businessMode === businessMode &&
      session.user.organizationName === organizationName;

    if (isCurrent || requestedRef.current === fingerprint) return;
    requestedRef.current = fingerprint;
    void update({ activeOrganizationId: organizationId });
  }, [businessMode, organizationId, organizationName, session, status, update]);

  return null;
}
