"use client"

import { useMemo, useState, type ReactNode } from "react"
import { BookOpen, CircleHelp } from "lucide-react"
import { DialogComponent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GLOSSARY } from "@/lib/glossary"
import { matchesSearch } from "@/lib/search"
import { cn } from "@/lib/utils"

// «¿Qué significa?»: la palabra del sistema se queda tal cual y, junto a ella,
// un botoncito abre un modal con la explicación relajada. Desde ahí también se
// puede abrir el glosario completo.

export function GlossaryHint({ term, children, className }: { term: string; children?: ReactNode; className?: string }) {
  const entry = GLOSSARY[term]
  const [open, setOpen] = useState(false)
  const [all, setAll] = useState(false)
  if (!entry) return null
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        aria-label={`¿Qué significa ${entry.term}?`}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 align-middle text-muted-foreground transition hover:text-primary focus-visible:text-primary focus-visible:outline-none",
          children ? "text-xs font-medium underline-offset-2 hover:underline" : "size-5 justify-center rounded-full",
          className
        )}
      >
        <CircleHelp className={children ? "size-3.5" : "size-4"} />
        {children}
      </button>
      <DialogComponent
        open={open}
        onOpenChange={setOpen}
        icon={<CircleHelp className="size-5 text-primary" />}
        title={entry.term}
        description={entry.short}
        className="sm:max-w-md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false)
                setAll(true)
              }}
            >
              <BookOpen className="size-4" /> Ver todo el glosario
            </Button>
            <Button onClick={() => setOpen(false)}>Entendido</Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p>{entry.body}</p>
          {entry.example && (
            <p className="rounded-lg bg-muted px-3 py-2 text-muted-foreground">
              <strong className="text-foreground">Ejemplo:</strong> {entry.example}
            </p>
          )}
        </div>
      </DialogComponent>
      <GlossaryDialog open={all} onOpenChange={setAll} />
    </>
  )
}

export function GlossaryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [q, setQ] = useState("")
  const entries = useMemo(
    () =>
      Object.entries(GLOSSARY)
        .filter(([, e]) => !q.trim() || matchesSearch(e.term, q) || matchesSearch(e.short, q))
        .sort((a, b) => a[1].term.localeCompare(b[1].term, "es")),
    [q]
  )
  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      icon={<BookOpen className="size-5 text-primary" />}
      title="¿Qué significa cada cosa?"
      description="Las palabras del sistema, explicadas sin complicaciones."
      className="sm:max-w-lg"
      footer={<Button onClick={() => onOpenChange(false)}>Cerrar</Button>}
    >
      <div className="space-y-3">
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca una palabra…" aria-label="Buscar en el glosario" />
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No encontramos esa palabra.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map(([id, e]) => (
              <li key={id} className="rounded-xl border bg-card p-3">
                <p className="text-sm font-semibold">{e.term}</p>
                <p className="text-sm text-muted-foreground">{e.body}</p>
                {e.example && <p className="mt-1 text-xs text-muted-foreground">Ejemplo: {e.example}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </DialogComponent>
  )
}
