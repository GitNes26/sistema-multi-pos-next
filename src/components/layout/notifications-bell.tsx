"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCheck,
  ClipboardList,
  ShoppingCart,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotificationStore, type AppNotification } from "@/stores/notifications-store";
import { useNotificationSse } from "@/hooks/use-notifications";

const ICONS: Record<string, React.ReactNode> = {
  "sale-complete": <ShoppingCart className="size-3.5" />,
  "low-stock": <AlertTriangle className="size-3.5" />,
  "order-received": <ClipboardList className="size-3.5" />,
};

// FASE 5.4 — Campana de notificaciones: badge animado + popover + SSE.
export function NotificationsBell() {
  useNotificationSse();

  const items = useNotificationStore((s) => s.items);
  const unread = useNotificationStore((s) => s.unread);
  const connected = useNotificationStore((s) => s.connected);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notificaciones${unread ? ` (${unread} sin leer)` : ""}`}
          className="relative"
        >
          <AnimatePresence>
            {unread > 0 ? (
              <motion.span
                key="ring"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
              >
                <BellRing className="size-4" />
              </motion.span>
            ) : (
              <motion.span
                key="bell"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
              >
                <Bell className="size-4" />
              </motion.span>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
                className="absolute -right-0.5 -top-0.5"
              >
                <Badge className="size-4 min-w-4 rounded-full p-0 text-[0.6rem] tabular-nums">
                  {unread > 9 ? "9+" : unread}
                </Badge>
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={6} className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Notificaciones</span>
            <span className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
              <span
                className={cn("size-1.5 rounded-full", connected ? "bg-emerald-500" : "bg-amber-500")}
              />
              {connected ? "en vivo" : "demo"}
            </span>
          </div>
          {unread > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={markAllRead}
            >
              <CheckCheck className="size-3.5" />
              Leer todo
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-80">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Sparkles className="size-6 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                Sin notificaciones
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <NotificationRow key={n.id} n={n} onMark={markRead} />
              ))}
            </ul>
          )}
        </ScrollArea>

        <div className="border-t px-3 py-2 text-center text-[0.65rem] text-muted-foreground">
          {connected
            ? "Conectado al servidor de eventos."
            : "Sin conexión SSE: mostrando ejemplos (FASE 11)."}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotificationRow({
  n,
  onMark,
}: {
  n: AppNotification;
  onMark: (id: string) => void;
}) {
  return (
    <li
      className={cn(
        "flex cursor-pointer items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-accent/60",
        !n.read && "bg-primary/[0.03]"
      )}
      onClick={() => onMark(n.id)}
    >
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
          n.read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
        )}
      >
        {ICONS[n.icon ?? ""] ?? <Bell className="size-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{n.title}</span>
          {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
        </span>
        {n.description && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
            {n.description}
          </span>
        )}
        <time className="mt-0.5 block text-[0.65rem] text-muted-foreground/70">
          {formatDistanceToNow(new Date(n.createdAt), {
            addSuffix: true,
            locale: es,
          })}
        </time>
      </span>
    </li>
  );
}