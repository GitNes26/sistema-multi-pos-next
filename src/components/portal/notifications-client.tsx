"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, ShoppingCart, Package, Truck, AlertTriangle, CheckCircle2, CheckCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { PullToRefresh } from "@/components/shared/pull-to-refresh"
import { EmptyState } from "@/components/shared/empty-state"
import { SwipeableRow } from "@/components/shared/swipeable-row"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { playSound } from "@/lib/sounds"

interface PortalNotification {
  id: string
  kind: string
  title: string
  body: string | null
  severity: string
  link: string | null
  metadata: Record<string, unknown> | null
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

function getPortalLink(n: PortalNotification): string | null {
  if (n.kind === "order") {
    const orderId = (n.metadata as Record<string, unknown>)?.orderId
    if (typeof orderId === "string") return `/portal/orders/${orderId}`
    return "/portal/orders"
  }
  if (n.link) {
    return n.link.replace(/^\/admin\//, "/portal/")
  }
  return null
}

export function NotificationsClient() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<PortalNotification[] | null>(null)
  const prevIdsRef = useRef<Set<string>>(new Set())

  const load = useCallback(async (playNotifSound = false) => {
    try {
      const res = await fetch("/api/portal/notifications", { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      const items: PortalNotification[] = data.notifications ?? []

      if (playNotifSound && prevIdsRef.current.size > 0) {
        const newItems = items.filter((n) => !prevIdsRef.current.has(n.id) && !n.readAt)
        if (newItems.length > 0) {
          playSound("notification")
        }
      }

      prevIdsRef.current = new Set(items.map((n) => n.id))
      setNotifications(items)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    load(false)
  }, [load])

  // Polling cada 30 segundos con sonido
  useEffect(() => {
    const interval = setInterval(() => {
      load(true)
    }, 30_000)
    return () => clearInterval(interval)
  }, [load])

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/portal/notifications/${id}`, { method: "PATCH", credentials: "include" })
      setNotifications((prev) =>
        prev?.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)) ?? prev
      )
    } catch {
      // silent
    }
  }

  const markAllAsRead = async () => {
    if (!notifications) return
    const unread = notifications.filter((n) => !n.readAt)
    await Promise.all(unread.map((n) => markAsRead(n.id)))
  }

  const handleClick = (n: PortalNotification) => {
    markAsRead(n.id)
    const link = getPortalLink(n)
    if (link) {
      router.push(link)
    }
  }

  const unreadCount = notifications?.filter((n) => !n.readAt).length ?? 0

  if (!notifications) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-48 rounded-xl" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <PullToRefresh onRefresh={load}>
      <div className="space-y-4 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="size-5 text-primary" />
            <h1 className="text-lg font-bold">Notificaciones</h1>
            {unreadCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-muted-foreground"
              onClick={markAllAsRead}
            >
              <CheckCheck className="size-3.5" /> Marcar todo leído
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Sin notificaciones"
            description="Aquí verás tus pedidos, promociones y avisos."
          />
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {notifications.map((n, idx) => {
                const Icon = KIND_ICONS[n.kind] ?? Bell
                const unread = !n.readAt
                return (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <SwipeableRow onDelete={() => markAsRead(n.id)}>
                      <button
                        onClick={() => handleClick(n)}
                        className={cn(
                          "w-full rounded-2xl border-2 p-3.5 text-left transition-all active:scale-[0.98]",
                          unread
                            ? "border-primary/20 bg-primary/5 shadow-sm"
                            : "border-transparent bg-card"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", SEVERITY_COLORS[n.severity] ?? SEVERITY_COLORS.info)}>
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className={cn("truncate text-sm", unread ? "font-bold" : "font-medium")}>{n.title}</p>
                              {unread && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                            </div>
                            {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                            <p className="mt-1 text-[11px] text-muted-foreground/60">
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
                    </SwipeableRow>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </PullToRefresh>
  )
}
