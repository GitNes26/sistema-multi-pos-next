import Link from "next/link";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/logo";
import packageJson from "../../../package.json";

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
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background p-4">
      {/* ── Fondo decorativo ── */}
      <div className="pointer-events-none absolute inset-0">
        {/* Gradientes radiales */}
        <div className="absolute -top-1/4 -left-1/4 h-[80vh] w-[80vh] rounded-full bg-primary/[0.07] blur-[120px]" />
        <div className="absolute -right-1/4 -bottom-1/4 h-[60vh] w-[60vh] rounded-full bg-primary/[0.05] blur-[100px]" />
        <div className="absolute top-1/3 right-1/4 h-[40vh] w-[40vh] rounded-full bg-violet-500/[0.04] blur-[80px]" />

        {/* Grid sutil */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--foreground) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {/* ── Contenido ── */}
      <div className="relative z-10 mb-6 flex flex-col items-center gap-2 text-center">
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

      <div className={cn("relative z-10 w-full", "flex justify-center")}>
        {children}
      </div>

      <div className="relative z-10 mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {footerLinks}
      </div>

      <p className="relative z-10 mt-4 text-[0.65rem] text-muted-foreground/50">
        Sistema Multi-POS v{packageJson.version}
      </p>
    </div>
  );
}
