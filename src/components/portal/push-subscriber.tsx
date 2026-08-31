"use client";

import { useEffect, useState, useCallback } from "react";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Componente que gestiona la suscripción Web Push del cliente.
 * Muestra un botón flotante para activar/desactivar notificaciones push.
 * Se auto-suscribe en el primer load si el permiso ya fue otorgado.
 */
export function PushSubscriber() {
  const { subscribe, unsubscribe, isSubscribed } = usePushSubscription();
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setLoading(false);
      return;
    }
    setSupported(true);

    // Verificar estado actual y auto-suscribir si el permiso ya es "granted"
    (async () => {
      try {
        const alreadySubscribed = await isSubscribed();
        setSubscribed(alreadySubscribed);

        // Auto-suscribir si el permiso ya fue dado y no hay suscripción activa
        if (!alreadySubscribed && Notification.permission === "granted") {
          const ok = await subscribe();
          setSubscribed(ok);
        }
      } catch {
        // noop
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(async () => {
    setLoading(true);
    try {
      if (subscribed) {
        await unsubscribe();
        setSubscribed(false);
      } else {
        const ok = await subscribe();
        setSubscribed(ok);
      }
    } finally {
      setLoading(false);
    }
  }, [subscribed, subscribe, unsubscribe]);

  // No mostrar nada si no soporta push
  if (!supported || loading) return null;

  return (
    <Button
      variant={subscribed ? "default" : "outline"}
      size="sm"
      onClick={toggle}
      className="gap-1.5"
      title={subscribed ? "Notificaciones push activadas" : "Activar notificaciones push"}
    >
      {subscribed ? (
        <>
          <Bell className="h-4 w-4" />
          <span className="hidden sm:inline">Push activo</span>
        </>
      ) : (
        <>
          <BellOff className="h-4 w-4" />
          <span className="hidden sm:inline">Activar push</span>
        </>
      )}
    </Button>
  );
}
