"use client";

import * as React from "react";
import { useNotificationStore, type AppNotification } from "@/stores/notifications-store";

// FASE 5.4 / 11 — Cliente SSE para notificaciones en tiempo real.
// Se conecta a `/api/notifications/stream`; reintenta con backoff. Si el
// endpoint aún no existe (FASE 11) cae en modo demo para validar el UI.

const MAX_RETRIES = 6;

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
          };
          if (Array.isArray(data.items)) {
            store().setItems(data.items);
          } else if (data.id && data.title) {
            store().push({
              id: data.id,
              title: data.title,
              description: data.description,
              icon: data.icon,
              href: data.href,
              read: false,
              createdAt: data.createdAt ?? new Date().toISOString(),
            });
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