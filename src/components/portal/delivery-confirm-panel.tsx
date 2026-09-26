"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Copy, Check } from "lucide-react";
import QRCode from "qrcode";

// Panel de confirmación: muestra PIN + QR al cliente para que el empleado
// lo escanee o lo teclee al entregar (domicilio) o recoger (sucursal).

interface DeliveryConfirmPanelProps {
  pin: string | null;
  qrToken: string | null;
  orderNumber: number;
  mode: "delivery" | "pickup";
}

export function DeliveryConfirmPanel({ pin, qrToken, orderNumber, mode }: DeliveryConfirmPanelProps) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!qrToken) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(qrToken, {
      width: 240,
      margin: 2,
      color: { dark: "#1e293b", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [qrToken]);

  if (!pin) return null;

  const isPickup = mode === "pickup";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-5"
    >
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="size-5 text-primary" />
        <h3 className="text-base font-semibold">
          {isPickup ? "Confirmación de recogida" : "Confirmación de entrega"}
        </h3>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        {isPickup
          ? `Muestra este PIN o QR en sucursal para recoger tu pedido #${orderNumber}.`
          : `Comparte este PIN o QR con el repartidor para confirmar que recibiste tu pedido #${orderNumber}.`}
      </p>

      {/* PIN */}
      <div className="mb-4">
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          PIN de confirmación
        </p>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-3 font-mono text-2xl font-bold tracking-[0.3em] text-foreground shadow-inner">
            {pin.split("").map((d, i) => (
              <span key={i} className="inline-block w-7 text-center">
                {d}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors hover:bg-primary/20 active:scale-95"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </button>
        </div>
      </div>

      {/* QR */}
      {qrDataUrl && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Código QR
          </p>
          <div className="flex justify-center rounded-xl bg-white p-3 shadow-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR de confirmación" className="size-[180px]" />
          </div>
        </div>
      )}
    </motion.div>
  );
}
