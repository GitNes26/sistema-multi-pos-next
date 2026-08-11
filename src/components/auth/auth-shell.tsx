import Link from "next/link";
import { cn } from "@/lib/utils";

// FASE 2.2/2.3 — Marco común de las pantallas de autenticación.
export function AuthShell({
  children,
  mode,
  footerLinks,
}: {
  children: React.ReactNode;
  mode?: "pos" | "portal";
  footerLinks?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <Link
          href={mode === "portal" ? "/portal/auth/login" : "/"}
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M3 9.5 12 4l9 5.5-9 5.5-9-5.5Z"
                fill="currentColor"
                opacity="0.9"
              />
              <path d="M6 12v4.5l6 3.5 6-3.5V12" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </span>
          Multi-POS
        </Link>
        <p className="text-xs text-muted-foreground">
          {mode === "portal"
            ? "Pedidos, promociones y lealtad en un solo lugar."
            : "Punto de venta multi-sucursal."}
        </p>
      </div>

      <div className={cn("w-full", "flex justify-center")}>{children}</div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {footerLinks}
      </div>
    </div>
  );
}