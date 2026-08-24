"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ScanLine, KeyRound, Loader2, ShieldCheck, Camera, RotateCcw } from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";
import { ordersApi } from "@/lib/orders/client";

// Diálogo del empleado/repartidor para confirmar entrega o recogida:
// escanea el QR del cliente (cámara) o teclea el PIN (fallback sin cámara).

interface DeliveryConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: number;
  mode: "delivery" | "pickup";
  onConfirmed: () => void;
}

type Mode = "scan" | "pin";

export function DeliveryConfirmDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  mode,
  onConfirmed,
}: DeliveryConfirmDialogProps) {
  const [tab, setTab] = useState<Mode>("scan");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const scannerRef = useRef<unknown>(null);
  const scannerBoxId = useRef(`qr-scan-${orderId}`);

  const title = mode === "pickup" ? "Confirmar recogida" : "Confirmar entrega";

  // Limpiar estado al abrir/cerrar
  useEffect(() => {
    if (open) {
      setPin("");
      setError(null);
      setTab("scan");
    }
  }, [open]);

  const stopScanner = async () => {
    const s = scannerRef.current as { stop?: () => Promise<void>; clear?: () => void } | null;
    if (s) {
      try {
        await s.stop?.();
      } catch { /* ignore */ }
      try {
        s.clear?.();
      } catch { /* ignore */ }
    }
    scannerRef.current = null;
    setScanning(false);
  };

  const startScanner = async () => {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(scannerBoxId.current);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1,
        },
        async (decodedText) => {
          // Detener al leer el primer QR válido
          await stopScanner();
          await submit({ qrToken: decodedText });
        },
        () => {
          // error de frame: ignorar silenciosamente
        }
      );
      setScanning(true);
    } catch (err) {
      setError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Permiso de cámara denegado. Usa el PIN manual."
          : "No se pudo iniciar la cámara. Usa el PIN manual."
      );
      setTab("pin");
    }
  };

  // Iniciar/detener escáner según tab y apertura
  useEffect(() => {
    if (open && tab === "scan") {
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  const submit = async ({ pin: pinValue, qrToken }: { pin?: string; qrToken?: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await ordersApi.confirmDelivery(orderId, { pin: pinValue, qrToken });
      if (!res.ok) {
        setError("Código inválido. Inténtalo de nuevo.");
        return;
      }
      await stopScanner();
      onConfirmed();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo confirmar");
    } finally {
      setSubmitting(false);
    }
  };

  const submitPin = () => {
    if (pin.length !== 6) return;
    submit({ pin });
  };

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      icon={<ShieldCheck className="size-5 text-primary" />}
      title={`${title} — #${orderNumber}`}
      description="Escanea el QR del cliente o teclea su PIN de 6 dígitos."
      bodyClassName="space-y-4"
      footerClassName="gap-2"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          {tab === "pin" && (
            <Button onClick={submitPin} disabled={pin.length !== 6 || submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              Confirmar
            </Button>
          )}
        </div>
      }
    >
      {/* Toggle escanear / teclear */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        <button
          type="button"
          onClick={() => setTab("scan")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
            tab === "scan" ? "bg-card shadow-sm" : "text-muted-foreground"
          )}
        >
          <ScanLine className="size-3.5" /> Escanear QR
        </button>
        <button
          type="button"
          onClick={() => setTab("pin")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
            tab === "pin" ? "bg-card shadow-sm" : "text-muted-foreground"
          )}
        >
          <KeyRound className="size-3.5" /> Teclear PIN
        </button>
      </div>

      {tab === "scan" ? (
        <div className="space-y-3">
          <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-black/5">
            <div id={scannerBoxId.current} className="absolute inset-0" />
            {!scanning && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Camera className="size-8" />
                <span className="text-xs">Iniciando cámara…</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              stopScanner().then(() => startScanner());
            }}
            className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" /> Reiniciar cámara
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Pide al cliente su PIN de 6 dígitos.</p>
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={pin}
              autoFocus
              onChange={(v) => {
                setPin(v.replace(/\D/g, ""));
                setError(null);
              }}
              onComplete={submitPin}
            >
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} className="size-11 text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
        </div>
      )}

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
        >
          {error}
        </motion.p>
      )}
    </DialogComponent>
  );
}
