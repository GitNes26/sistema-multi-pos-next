import { cn } from "@/lib/utils";

// FASE 5.2 — Logotipo reutilizable (marca Multi-POS).

export function Logo({
  className,
  size = 24,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground",
        className
      )}
      style={{ width: size + 8, height: size + 8 }}
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