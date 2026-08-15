"use client";

import * as React from "react";
import { useNotificationStore, type AppNotification } from "@/stores/notifications-store";
import { playSound } from "@/lib/sounds";
import { swalNotificationToast } from "@/lib/swal";

// FASE 5.4 / 11 — Cliente SSE para notificaciones en tiempo real.
// Conecta a `/api/notifications/stream`; reintenta con backoff. Al recibir una
// notificación individual reproduce su sonido (11.5) y muestra toast (11.4).

const MAX_RETRIES = 6;

const SOUND_BY_ICON: Record<string, Parameters<typeof playSound>[0]> = {
  "sale-complete": "sale-complete",
  "low-stock": "low-stock",
  "order-received": "order-received",
  "order-ready": "order-ready",
  notification: "notification",
  success: "sale-complete",
};

export function useNotificationSse(enabled = true) {
  const seeded = React.useRef(false);

  React.useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const store = useNotificationStore.getState;
    let es: EventSource | null = null;
    let retries = 0;
    let closed = false;

    const connect = () => {
      es = new EventSource("/api/notifications/stream");

      es.onopen = () => {
        retries = 0;
        store().setConnected(true);
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as Partial<AppNotification> & {
            items?: AppNotification[];
            sound?: string;
          };
          if (Array.isArray(data.items)) {
            store().setItems(data.items);
          } else if (data.id && data.title) {
            const n: AppNotification = {
              id: data.id,
              title: data.title,
              description: data.description,
              icon: data.icon,
              href: data.href,
              read: false,
              createdAt: data.createdAt ?? new Date().toISOString(),
            };
            store().push(n);
            playSound(
              (data.sound as Parameters<typeof playSound>[0] | undefined) ??
                SOUND_BY_ICON[n.icon ?? ""] ??
                "notification",
              { volume: 0.7 }
            );
            swalNotificationToast(n);
          }
        } catch {
          // Ignorar mensajes no JSON
        }
      };

      es.onerror = () => {
        es?.close();
        store().setConnected(false);
        if (!closed && retries < MAX_RETRIES) {
          retries += 1;
          const delay = Math.min(1000 * 2 ** retries, 15_000);
          setTimeout(connect, delay);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      es?.close();
    };
  }, [enabled]);

  // Modo demo: si el SSE no conectó tras los reintentos, siembra ejemplos.
  React.useEffect(() => {
    if (!enabled || seeded.current) return;
    const timer = setTimeout(() => {
      const { connected, items, seedDemo } = useNotificationStore.getState();
      if (!connected && items.length === 0) {
        seedDemo();
        seeded.current = true;
      }
    }, 6_000);
    return () => clearTimeout(timer);
  }, [enabled]);
}