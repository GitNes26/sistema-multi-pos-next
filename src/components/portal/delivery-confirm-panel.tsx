"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Copy, Check } from "lucide-react";
import { useState } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

// Panel de confirmación de entrega: muestra PIN + QR al cliente cuando
// el driver está en "at_destination". El driver escanea o teclea para entregar.

interface DeliveryConfirmPanelProps {
  pin: string | null;
  qrToken: string | null;
  orderNumber: number;
}

export function DeliveryConfirmPanel({ pin, qrToken, orderNumber }: DeliveryConfirmPanelProps) {
  const [copied, setCopied] = useState(false);

  const qrDataUrl = useMemo(() => {
    if (!qrToken) return null;
    let dataUrl = "";
    QRCode.toDataURL(qrToken, {
      width: 200,
      margin: 2,
      color: { dark: "#1e293b", light: "#ffffff" },
    })
      .then((url) => { dataUrl = url; })
      .catch(() => {});
    return dataUrl;
  }, [qrToken]);

  if (!pin) return null;

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
      className="rounded-2xl border-2 border-purple-300 bg-purple-50/50 p-5 shadow-sm dark:bg-purple-950/20"
    >
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="size-5 text-purple-600" />
        <h3 className="text-sm font-bold text-purple-700 dark:text-purple-300">
          Confirmación de entrega
        </h3>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        Comparte este PIN o QR con el repartidor para confirmar que recibiste tu pedido #{orderNumber}.
      </p>

      {/* PIN */}
      <div className="mb-4">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          PIN de confirmación
        </p>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-3 font-mono text-2xl font-bold tracking-[0.3em] text-slate-800 shadow-inner dark:bg-slate-800 dark:text-slate-100">
            {pin.split("").map((d, i) => (
              <span key={i} className="inline-block w-7 text-center">
                {d}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-600 transition-colors hover:bg-purple-200 active:scale-95 dark:bg-purple-900/30"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </button>
        </div>
      </div>

      {/* QR */}
      {qrDataUrl && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Código QR
          </p>
          <div className="flex justify-center rounded-xl bg-white p-3 shadow-inner dark:bg-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR de confirmación" className="size-[180px]" />
          </div>
        </div>
      )}
    </motion.div>
  );
}
