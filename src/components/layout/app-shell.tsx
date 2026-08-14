"use client";

import * as React from "react";

import {
  BOTTOM_NAV,
  NAV_SECTIONS,
  filterNavSectionsByUser,
} from "@/lib/nav";
import type { PermissionKey } from "@/lib/auth/permission-keys";
import { useMenus } from "@/hooks/use-menus";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { NavigationDrawer } from "@/components/layout/navigation-drawer";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { RouteTransition } from "@/components/layout/route-transition";
import type { UserMenuUser } from "@/components/layout/user-menu";

export interface AppShellProps {
  user: UserMenuUser;
  permissions?: PermissionKey[];
  children: React.ReactNode;
}

// FASE 5.1 / 5.10 / 14.7 — Un solo shell adaptativo.
// El menú viene de la BD (useMenus) y cae al fallback hardcodeado mientras carga.
export function AppShell({ user, permissions, children }: AppShellProps) {
  const { sections: dbSections, bottomItems } = useMenus();

  const fallbackSections = React.useMemo(
    () => filterNavSectionsByUser({ user: { role: user.role, permissions } }, NAV_SECTIONS),
    [user.role, permissions]
  );
  const sections = dbSections ?? fallbackSections;
  const bottomNav = bottomItems ?? BOTTOM_NAV;

  return (
    <div className="flex min-h-svh bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] border-r bg-sidebar lg:block">
        <AppSidebar sections={sections} />
      </aside>

      <div className="flex min-h-svh w-full flex-col lg:pl-[var(--sidebar-width)]">
        <AppHeader sections={sections} user={user} />

        <main className="flex-1 px-3 pb-24 pt-4 sm:px-4 md:px-6 md:pb-8 md:pt-6">
          <RouteTransition>{children}</RouteTransition>
        </main>
      </div>

      <NavigationDrawer sections={sections} />
      <BottomTabBar
        items={bottomNav}
        permissions={permissions}
        role={user.role}
      />
    </div>
  );
}