"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { DigitalMenu } from "@/components/portal/digital-menu/digital-menu";
import { Spinner } from "@/components/base/spinner";

function MenuContent() {
  const searchParams = useSearchParams();
  const tableId = searchParams.get("table") || undefined;
  const tableToken = searchParams.get("token") || undefined;

  return <DigitalMenu tableId={tableId} tableToken={tableToken} />;
}

export default function MenuPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <Spinner />
        </div>
      }
    >
      <MenuContent />
    </Suspense>
  );
}
