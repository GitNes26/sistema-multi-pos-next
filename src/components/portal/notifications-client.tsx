"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Bell, ShoppingCart, Package, Truck, AlertTriangle, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { PullToRefresh } from "@/components/shared/pull-to-refresh"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/ui/skeleton"

interface PortalNotification {
  id: string
  kind: string
  title: string
  body: string | null
  severity: string
  link: string | null
  readAt: string | null
  createdAt: string
}

const KIND_ICONS: Record<string, typeof Bell> = {
  sale: ShoppingCart,
  order: Package,
  delivery: Truck,
  low_stock: AlertTriangle,
  promotion: CheckCircle2,
}

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-600",
  success: "bg-emerald-500/10 text-emerald-600",
  warning: "bg-amber-500/10 text-amber-600",
  error: "bg-destructive/10 text-destructive",
}

export function NotificationsClient() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<PortalNotification[] | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/notifications")
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications ?? [])
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/portal/notifications/${id}`, { method: "PATCH" })
      setNotifications((prev) =>
        prev?.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)) ?? prev
      )
    } catch {
      // silent
    }
  }

  const handleClick = (n: PortalNotification) => {
    markAsRead(n.id)
    if (n.link) {
      router.push(n.link)
    }
  }

  if (!notifications) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <PullToRefresh onRefresh={load}>
      <div className="space-y-3 p-4">
        {notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Sin notificaciones"
            description="Aquí verás tus pedidos, promociones y avisos."
          />
        ) : (
          notifications.map((n) => {
            const Icon = KIND_ICONS[n.kind] ?? Bell
            const unread = !n.readAt
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  "w-full rounded-xl border p-3.5 text-left transition-all active:scale-[0.98]",
                  unread ? "border-primary/20 bg-primary/5" : "border-border/50 bg-background"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", SEVERITY_COLORS[n.severity] ?? SEVERITY_COLORS.info)}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={cn("truncate text-sm font-medium", unread && "font-semibold")}>{n.title}</p>
                      {unread && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground/70">
                      {new Date(n.createdAt).toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </PullToRefresh>
  )
}
