"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";
import {
  filterNavItems,
  isNavActive,
  type NavItem,
} from "@/lib/nav";
import type { PermissionKey } from "@/lib/auth/permission-keys";
import { useNotificationStore } from "@/stores/notifications-store";

export interface BottomTabBarProps {
  items: NavItem[];
  permissions?: PermissionKey[];
  role?: string | null;
}

// FASE 5.6 — BottomTabBar móvil: íconos + labels, 4-5 ítems principales.
export function BottomTabBar({ items, permissions = [], role }: BottomTabBarProps) {
  const pathname = usePathname();
  const unread = useNotificationStore((s) => s.unread);

  const visible = React.useMemo(
    () =>
      filterNavItems({ user: { role, permissions } }, items).filter(
        (i): i is NavItem & { href: string } => Boolean(i.href)
      ),
    [items, permissions, role]
  );

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid h-14 max-w-lg grid-cols-5">
        {visible.map((item) => {
          const active = isNavActive(item, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-0.5 text-[0.65rem] font-medium text-muted-foreground transition-colors",
                  active && "text-foreground"
                )}
              >
                <AnimatePresence>
                  {active && (
                    <motion.span
                      layoutId="bottom-tab-active"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      className="absolute top-0 h-0.5 w-8 rounded-full bg-primary"
                    />
                  )}
                </AnimatePresence>
                <span className="relative">
                  <Icon className={cn("size-5", active && "text-primary")} />
                  {item.href === "/pos" && unread > 0 && (
                    <span className="absolute -right-1.5 -top-1 size-2 rounded-full bg-destructive" />
                  )}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}