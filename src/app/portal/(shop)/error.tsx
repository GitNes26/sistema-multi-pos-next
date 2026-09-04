"use client";

import { ErrorBoundaryFallback } from "@/components/shared/error-boundary";

// FASE 20.3 — Error boundary de la sección portal.

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isAuthError =
    error.message?.includes("CLIENT_FETCH_ERROR") ||
    error.message?.includes("session") ||
    error.message?.includes("Failed to fetch");

  return (
    <ErrorBoundaryFallback
      reset={reset}
      title={isAuthError ? "Sesión no disponible" : "Algo salió mal"}
      description={
        isAuthError
          ? "Tu sesión puede haber expirado. Inicia sesión de nuevo."
          : error.message || "Ocurrió un error inesperado. Inténtalo de nuevo."
      }
    />
  );
}
