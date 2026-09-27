"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ScanLine, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";
import { ordersApi } from "@/lib/orders/client";
import { QrScanner } from "@/components/shared/qr-scanner";

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
  const [submitting, setSubmitting] = useState(false);
  // Cambiar la llave remonta el lector (volver a escanear tras un QR inválido).
  const [scanKey, setScanKey] = useState(0);

  const title = mode === "pickup" ? "Confirmar recogida" : "Confirmar entrega";

  // Limpiar estado al abrir/cerrar
  useEffect(() => {
    if (open) {
      setPin("");
      setError(null);
      setTab("scan");
    }
  }, [open]);

  const submit = async ({ pin: pinValue, qrToken }: { pin?: string; qrToken?: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await ordersApi.confirmDelivery(orderId, { pin: pinValue, qrToken });
      if (!res.ok) {
        setError("Código inválido. Inténtalo de nuevo.");
        setScanKey((k) => k + 1);
        return;
      }
      onConfirmed();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo confirmar");
      setScanKey((k) => k + 1);
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
        <QrScanner
          key={scanKey}
          active={open && tab === "scan" && !submitting}
          onResult={(qrToken) => void submit({ qrToken })}
          onUsePin={() => setTab("pin")}
        />
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
