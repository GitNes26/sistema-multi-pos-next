"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { isNavActive, type NavItem } from "@/lib/nav";
import { useUiStore } from "@/stores/ui-store";

export interface NavLinkProps {
  item: NavItem;
  onNavigate?: () => void;
  className?: string;
  showActiveBar?: boolean;
}

// FASE 5.5 — Enlace de navegación con estado activo animado.
export function NavLink({
  item,
  onNavigate,
  className,
  showActiveBar = true,
}: NavLinkProps) {
  const pathname = usePathname();
  const setNavOpen = useUiStore((s) => s.setNavOpen);
  const active = isNavActive(item, pathname);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={() => {
        setNavOpen(false);
        onNavigate?.();
      }}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        active && "bg-sidebar-accent text-sidebar-accent-foreground",
        className
      )}
    >
      {showActiveBar && active && (
        <motion.span
          layoutId="nav-active-bar"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
          className="absolute left-0 h-5 w-1 rounded-r bg-sidebar-primary"
        />
      )}
      <Icon
        className={cn(
          "size-[1.05rem] shrink-0 text-sidebar-foreground/60 transition-colors group-hover:text-sidebar-accent-foreground",
          active && "text-sidebar-primary"
        )}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}