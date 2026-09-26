import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import packageJson from "../../../package.json";

// Pantalla de acceso a dos paneles: en tablet horizontal y escritorio, la marca
// a la izquierda y el formulario a la derecha; en teléfono, una sola columna
// sin tarjeta flotante (el formulario ocupa el lienzo, como una app nativa).

const BRAND_COPY = {
  pos: {
    name: "Multi-POS",
    headline: "Vende rápido. Controla cada sucursal.",
    points: [
      "Caja táctil con granel, variantes y pagos divididos",
      "Inventario por sucursal y CEDIS, visto en un solo lugar",
      "Cocina, agenda y reservaciones conectadas a la venta",
    ],
  },
  portal: {
    name: "Tienda",
    headline: "Tu tienda de siempre, ahora en tu bolsillo.",
    points: [
      "Pide para recoger o a domicilio",
      "Sigue tu pedido en tiempo real",
      "Acumula puntos en cada compra",
    ],
  },
} as const;

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
  const copy = BRAND_COPY[mode ?? "pos"];
  const home = mode === "portal" ? "/portal/auth/login" : "/";

  return (
    <div className="relative grid min-h-dvh bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* ── Panel de marca (tablet horizontal / escritorio) ── */}
      <aside className="relative hidden overflow-hidden bg-sidebar lg:flex lg:flex-col lg:justify-between lg:border-r lg:p-12 xl:p-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(color-mix(in oklab, var(--primary) 10%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--primary) 10%, transparent) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse 90% 70% at 0% 100%, black, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 0% 100%, black, transparent 75%)",
          }}
        />
        <Link href={home} className="relative flex w-fit items-center gap-2.5 text-lg font-semibold tracking-tight">
          <Logo size={22} logoUrl={logoUrl} className="rounded-lg" />
          {copy.name}
        </Link>

        <div className="relative max-w-md animate-rise-in">
          <h1 className="font-heading text-4xl leading-[1.1] font-semibold tracking-tight xl:text-5xl">
            {copy.headline}
          </h1>
          <ul className="mt-8 space-y-3.5">
            {copy.points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-base text-muted-foreground">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-muted-foreground">
          Sistema Multi-POS v{packageJson.version}
        </p>
      </aside>

      {/* ── Formulario ── */}
      <main className="safe-area-top safe-area-bottom flex min-h-dvh flex-col px-5 py-8 sm:px-8">
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="mb-8 flex w-full max-w-sm flex-col items-start gap-3 lg:hidden">
            <Link href={home} className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
              <Logo size={22} logoUrl={logoUrl} className="rounded-lg" />
              {copy.name}
            </Link>
            <p className="font-heading text-2xl leading-tight font-semibold tracking-tight text-balance">
              {copy.headline}
            </p>
          </div>

          <div className="flex w-full justify-center">{children}</div>
        </div>

        <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {footerLinks}
          <Link href="/legal/terminos" className="py-1 hover:text-foreground hover:underline">Términos</Link>
          <Link href="/legal/privacidad" className="py-1 hover:text-foreground hover:underline">Privacidad</Link>
          <Link href="/legal/cookies" className="py-1 hover:text-foreground hover:underline">Cookies</Link>
          <span className="w-full text-center text-xs text-muted-foreground/70 lg:hidden">
            v{packageJson.version}
          </span>
        </footer>
      </main>
    </div>
  );
}
