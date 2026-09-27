import type { LucideIcon } from "lucide-react"

// Cinta infinita de capacidades. La lista se duplica para que el bucle sea
// continuo; la copia queda oculta para lectores de pantalla.
export function Marquee({ items }: { items: { icon: LucideIcon; label: string }[] }) {
  const row = (hidden: boolean) =>
    items.map((c) => (
      <li
        key={`${hidden ? "b" : "a"}-${c.label}`}
        aria-hidden={hidden || undefined}
        className="mr-3 inline-flex shrink-0 items-center gap-2 rounded-full border bg-card px-4 py-2.5 text-sm font-medium shadow-e1"
      >
        <c.icon className="size-4 text-primary" />
        {c.label}
      </li>
    ))

  return (
    <div className="marquee relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
      <ul aria-label="Capacidades incluidas" className="marquee-track flex w-max py-1">
        {row(false)}
        {row(true)}
      </ul>
    </div>
  )
}
