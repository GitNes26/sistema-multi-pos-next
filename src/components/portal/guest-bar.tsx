"use client"

import { useState } from "react"
import { UserRound } from "lucide-react"
import { DialogComponent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { GuestModeBar, GuestPicker } from "@/components/shared/guest-picker"
import { portalGuestNames, usePortalStore, type PortalCartItem } from "@/stores/portal-store"
import { cn } from "@/lib/utils"

/** «Pedir para varias personas» en el portal: interruptor + a quién se le está pidiendo. */
export function PortalGuestBar({ className }: { className?: string }) {
  const on = usePortalStore((s) => s.guestMode)
  const guestNames = usePortalStore((s) => s.guestNames)
  const items = usePortalStore((s) => s.items)
  const active = usePortalStore((s) => s.activeGuest)
  const setGuestMode = usePortalStore((s) => s.setGuestMode)
  const setActiveGuest = usePortalStore((s) => s.setActiveGuest)
  const addGuest = usePortalStore((s) => s.addGuest)
  return (
    <GuestModeBar
      className={className}
      on={on}
      onToggle={setGuestMode}
      names={portalGuestNames({ guestNames, items })}
      active={active}
      onSelect={setActiveGuest}
      onAdd={addGuest}
    />
  )
}

/** Ficha «Para: Juan» de un renglón del carrito; toca para cambiarlo de persona. */
export function CartGuestChip({ item, className }: { item: PortalCartItem; className?: string }) {
  const guestMode = usePortalStore((s) => s.guestMode)
  const guestNames = usePortalStore((s) => s.guestNames)
  const items = usePortalStore((s) => s.items)
  const addGuest = usePortalStore((s) => s.addGuest)
  const setItemGuest = usePortalStore((s) => s.setItemGuest)
  const [open, setOpen] = useState(false)
  if (!guestMode && !item.guestName) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "mt-1.5 inline-flex min-h-8 max-w-full cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition hover:border-primary/60",
          item.guestName ? "border-primary/40 bg-primary/10 text-primary" : "border-dashed text-muted-foreground"
        )}
      >
        <UserRound className="size-3.5 shrink-0" />
        <span className="truncate">{item.guestName ? `Para: ${item.guestName}` : "¿Para quién es?"}</span>
      </button>
      <DialogComponent
        open={open}
        onOpenChange={setOpen}
        icon={<UserRound className="size-5 text-primary" />}
        title="¿Para quién es?"
        description={item.name}
        className="sm:max-w-md"
        footer={<Button onClick={() => setOpen(false)}>Listo</Button>}
      >
        <GuestPicker
          names={portalGuestNames({ guestNames, items })}
          value={item.guestName ?? null}
          onChange={(name) => setItemGuest(item.key, name)}
          onAdd={addGuest}
          allowNone
        />
      </DialogComponent>
    </>
  )
}
