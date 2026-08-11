"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";

import { NavSection } from "@/lib/nav";
import { useUiStore } from "@/stores/ui-store";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// FASE 5.2 — Búsqueda global de navegación (Cmd/Ctrl+K).
export function SearchDialog({ sections }: { sections: NavSection[] }) {
  const router = useRouter();
  const searchOpen = useUiStore((s) => s.searchOpen);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(!useUiStore.getState().searchOpen);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSearchOpen]);

  const items = sections.flatMap((s) =>
    s.items.map((item) => ({ ...item, group: s.title ?? "General" }))
  );

  return (
    <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
      <CommandInput placeholder="Buscar página o acción…" />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>
        {items.map((item) => (
          <CommandGroup key={item.group} heading={item.group}>
            {items
              .filter((i) => i.group === item.group)
              .map((i) => (
                <CommandItem
                  key={i.href}
                  value={`${i.label} ${i.href}`}
                  onSelect={() => {
                    router.push(i.href);
                    setSearchOpen(false);
                  }}
                >
                  <i.icon className="size-4 text-muted-foreground" />
                  <span className="flex-1">{i.label}</span>
                  <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[0.6rem] text-muted-foreground">
                    <CornerDownLeft className="size-2.5" />
                  </kbd>
                </CommandItem>
              ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

export function SearchTrigger() {
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  return (
    <button
      type="button"
      onClick={() => setSearchOpen(true)}
      className="flex h-8 w-full max-w-56 items-center gap-2 rounded-lg border border-input bg-muted/40 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/70"
    >
      <Search className="size-4" />
      <span className="flex-1 text-left">Buscar…</span>
      <kbd className="rounded border bg-background px-1.5 py-0.5 text-[0.6rem] text-muted-foreground">
        ⌘K
      </kbd>
    </button>
  );
}