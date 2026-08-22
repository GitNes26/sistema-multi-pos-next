import { cn } from "@/lib/utils";

// Logotipo reutilizable: muestra el logo de la empresa si está disponible,否则 el SVG por defecto.

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

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground",
        className
      )}
      style={{ width: boxSize, height: boxSize }}
      aria-hidden
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          d="M3 9.5 12 4l9 5.5-9 5.5-9-5.5Z"
          fill="currentColor"
          opacity="0.9"
        />
        <path
          d="M6 12v4.5l6 3.5 6-3.5V12"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
