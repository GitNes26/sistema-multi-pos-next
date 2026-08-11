"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import { isNavActive, type NavSection } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { SearchDialog, SearchTrigger } from "@/components/layout/search-dialog";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { UserMenu, type UserMenuUser } from "@/components/layout/user-menu";
import { useUiStore } from "@/stores/ui-store";

export interface AppHeaderProps {
  sections: NavSection[];
  user: UserMenuUser;
}

// FASE 5.2 — Header sticky: menú, buscador, notificaciones y usuario.
export function AppHeader({ sections, user }: AppHeaderProps) {
  const pathname = usePathname();
  const toggleNav = useUiStore((s) => s.toggleNav);
  const navOpen = useUiStore((s) => s.navOpen);

  const activeLabel = React.useMemo(() => {
    for (const section of sections) {
      const found = section.items.find((item) => isNavActive(item, pathname));
      if (found) return found.label;
    }
    return "Panel";
  }, [sections, pathname]);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-14 items-center gap-2 px-3 pt-[env(safe-area-inset-top)] sm:px-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={navOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={navOpen}
          onClick={toggleNav}
          className="lg:hidden"
        >
          <Menu className="size-4" />
        </Button>

        <Logo size={18} className="lg:hidden rounded-lg" />

        <span className="hidden h-4 w-px bg-border lg:block" aria-hidden />

        <span
          className={cn(
            "truncate text-sm font-semibold",
            "flex-1 sm:flex-none lg:w-40"
          )}
        >
          {activeLabel}
        </span>

        <div className="hidden flex-1 justify-center md:flex">
          <SearchTrigger />
        </div>

        <div className="flex items-center gap-1">
          <NotificationsBell />
          <UserMenu user={user} />
        </div>
      </div>

      <SearchDialog sections={sections} />
    </header>
  );
}