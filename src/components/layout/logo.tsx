import { cn } from "@/lib/utils";
import { DEFAULT_LOGO_URL } from "@/lib/brand";

// Logotipo reutilizable: logo de la empresa si existe; si no, el logo oficial de Multi-POS.

export function Logo({
  className,
  size = 24,
  logoUrl,
}: {
  className?: string;
  size?: number;
  logoUrl?: string | null;
}) {
  const boxSize = size + 8;

  if (logoUrl) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-background",
          className
        )}
        style={{ width: boxSize, height: boxSize }}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt="Logo"
          className="size-full object-contain p-0.5"
          draggable={false}
        />
      </span>
    );
  }

  // Sin logo propio: marca oficial de Multi-POS sobre fondo claro (se lee en ambos temas).
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white", className)}
      style={{ width: boxSize, height: boxSize }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={DEFAULT_LOGO_URL} alt="Multi-POS" className="size-full object-contain p-1" draggable={false} />
    </span>
  );
}
