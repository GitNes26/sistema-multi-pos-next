"use client";

import { ErrorBoundaryFallback } from "@/components/shared/error-boundary";

// FASE 20.3 — Error boundary de la sección admin.

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorBoundaryFallback reset={reset} />;
}
