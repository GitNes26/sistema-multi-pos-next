import Link from "next/link";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/logo";
import packageJson from "../../../package.json";

// Marco común de las pantallas de autenticación.
export function AuthShell({
  children,
  mode,
  footerLinks,
  logoUrl,
}: {
  children: React.ReactNode;
  mode?: "pos" | "portal";
  footerLinks?: React.ReactNode;
  logoUrl?: string | null;
}) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <Link
          href={mode === "portal" ? "/portal/auth/login" : "/"}
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <Logo size={20} logoUrl={logoUrl} className="rounded-lg" />
          {mode === "portal" ? "Tienda" : "Multi-POS"}
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

      <p className="mt-4 text-[0.65rem] text-muted-foreground/50">
        Sistema Multi-POS v{packageJson.version}
      </p>
    </div>
  );
}
