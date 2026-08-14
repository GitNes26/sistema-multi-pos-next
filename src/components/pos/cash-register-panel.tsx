"use client";

import { useEffect, useState } from "react";
import { LockKeyhole, Unlock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { usePosStore } from "@/stores/pos-store";
import { money } from "@/lib/pos/money";
import { swalToast, swalError } from "@/lib/swal";
import { usePosRefresh } from "@/hooks/use-pos-refresh";

interface CashRegisterPanelProps {
  open: boolean;
  onClose: () => void;
}

interface SessionStats {
  todaySales: number;
  todayCount: number;
  session: { sales: number; cashPayments: number; changeGiven: number } | null;
}

export function CashRegisterPanel({ open, onClose }: CashRegisterPanelProps) {
  const session = usePosStore((s) => s.session);
  const registers = usePosStore((s) => s.registers);
  const registerId = usePosStore((s) => s.registerId);
  const setRegister = usePosStore((s) => s.setRegister);
  const refresh = usePosRefresh();

  const [stats, setStats] = useState<SessionStats | null>(null);
  const [openingCash, setOpeningCash] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOpeningCash("");
    setClosingCash("");
    setNotes("");
    fetch("/api/pos/cash", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.ok && setStats(d))
      .catch(() => undefined);
  }, [open]);

  const doOpen = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pos/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open",
          registerId,
          openingCash: parseFloat(openingCash.replace(",", ".")) || 0,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        swalError("No se pudo abrir la caja", data.error);
        return;
      }
      await refresh();
      swalToast(data.created ? "Caja abierta" : "Caja ya abierta");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const doClose = async () => {
    if (!session) return;
    const amount = parseFloat(closingCash.replace(",", "."));
    if (isNaN(amount) || amount < 0) {
      swalError("Ingresa un monto de cierre válido");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/pos/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "close",
          sessionId: session.id,
          closingCash: amount,
          notes,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        swalError("No se pudo cerrar la caja", data.error);
        return;
      }
      await refresh();
      const s = data.summary;
      const diff = s.difference;
      swalToast(
        `Cierre contabilizado (${s.salesCount} ventas, ${money(s.totalSales)})`,
        diff === 0 ? "success" : "warning"
      );
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const expected = stats?.session
    ? stats.session.cashPayments +
      (session?.openingCash ?? 0) -
      stats.session.changeGiven
    : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {session ? (
              <>
                <Unlock className="size-5 text-emerald-600" /> Caja abierta
              </>
            ) : (
              <>
                <LockKeyhole className="size-5 text-primary" /> Abrir caja
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            Sucursal {usePosStore.getState().location.name} · {stats?.todayCount ?? 0} ventas hoy · {money(stats?.todaySales ?? 0)}
          </DialogDescription>
        </DialogHeader>

        {session ? (
          <div className="space-y-3">
            <div className="rounded-xl border bg-card p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Caja registradora</span>
                <span className="font-medium">{session.registerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Apertura</span>
                <span className="font-medium tabular-nums">{money(session.openingCash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Abierta desde</span>
                <span>{new Date(session.openedAt).toLocaleString("es-MX")}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="text-muted-foreground">Esperado en caja</span>
                <span className="font-bold tabular-nums">{money(expected)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="closingCash">Monto final en caja ($)</Label>
              <Input
                id="closingCash"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="0.00"
                inputMode="decimal"
                autoFocus
              />
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas del corte (opcional)"
              />
              <Button className="w-full" onClick={doClose} disabled={loading}>
                {loading ? "Contabilizando…" : "Cerrar caja y cortar"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="register">Caja registradora</Label>
              <Select value={registerId} onValueChange={setRegister}>
                <SelectTrigger id="register">
                  <SelectValue placeholder="Selecciona caja" />
                </SelectTrigger>
                <SelectContent>
                  {registers.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                      {r.folioPrefix ? ` (${r.folioPrefix})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="openingCash">Fondo inicial en caja ($)</Label>
              <Input
                id="openingCash"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="0.00"
                inputMode="decimal"
              />
            </div>
            <Button className="w-full" onClick={doOpen} disabled={loading || !registerId}>
              {loading ? "Abriendo…" : "Abrir caja"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}