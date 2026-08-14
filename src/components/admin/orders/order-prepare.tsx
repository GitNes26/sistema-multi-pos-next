"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  Clock,
  PackageCheck,
  Play,
  ScanLine,
  Timer,
  UserRound,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { swalError, swalToast } from "@/lib/swal";
import { cn } from "@/lib/utils";
import {
  ORDER_STATUS_LABELS,
  ordersApi,
} from "@/lib/orders/client";
import type { PreparationView } from "@/lib/orders/server";

// FASE 12.3 — Página de preparación de pedido: timer, checklist, progreso, notas.

function useNow(startedAtMs: number | null, running: boolean) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!running || !startedAtMs) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running, startedAtMs]);
  return now;
}

function formatElapsed(s: number): string {
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  return [hours, mins, secs].map((v) => String(v).padStart(2, "0")).join(":");
}

export function OrderPrepare({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [prep, setPrep] = useState<PreparationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);

  const startedMs = prep?.startedAt ? new Date(prep.startedAt).getTime() : null;
  const running = Boolean(prep && !prep.completedAt && prep.startedAt);
  const now = useNow(startedMs, running);
  const elapsedSecs = prep?.startedAt
    ? prep.completedAt
      ? prep.elapsedSeconds ?? Math.round((new Date(prep.completedAt).getTime() - new Date(prep.startedAt).getTime()) / 1000)
      : Math.round((now - new Date(prep.startedAt).getTime()) / 1000)
    : 0;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await ordersApi.preparation(orderId);
      setPrep(r.prep);
    } catch {
      setPrep(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const foundCount = prep?.items.filter((i) => i.found).length ?? 0;
  const totalItems = prep?.items.length ?? 0;
  const progress = totalItems > 0 ? Math.round((foundCount / totalItems) * 100) : 0;

  const start = async () => {
    setBusy(true);
    try {
      const r = await ordersApi.startPreparation(orderId);
      setPrep(r.prep);
      swalToast("Preparación iniciada");
      setTimeout(() => scanRef.current?.focus(), 100);
    } catch (err) {
      swalError("No se pudo iniciar", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const toggleFound = async (item: PreparationView["items"][number]) => {
    const next = !item.found;
    setPrep((p) =>
      p
        ? { ...p, items: p.items.map((i) => (i.id === item.id ? { ...i, found: next, scanned: true } : i)) }
        : p
    );
    try {
      const r = await ordersApi.setPreparationItem(orderId, item.id, { found: next, scanned: true });
      setPrep((p) => (p ? { ...p, items: p.items.map((i) => (i.id === item.id ? r.item : i)) } : p));
    } catch (err) {
      swalError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    }
  };

  const saveNotes = async (item: PreparationView["items"][number], notes: string | null) => {
    setPrep((p) =>
      p ? { ...p, items: p.items.map((i) => (i.id === item.id ? { ...i, notes } : i)) } : p
    );
    try {
      await ordersApi.setPreparationItem(orderId, item.id, { notes });
    } catch {
      // silencioso
    }
  };

  const submitScan = () => {
    const q = scan.trim().toLowerCase();
    if (!q || !prep) return;
    const target = prep.items.find((i) => !i.found && (i.productName.toLowerCase().includes(q) || (i.variantName ?? "").toLowerCase().includes(q)));
    if (target) {
      toggleFound(target);
      swalToast(`Encontrado: ${target.productName}`);
    } else {
      swalError("Sin coincidencia", "Escribe el nombre del producto o su variante.");
    }
    setScan("");
  };

  const complete = async () => {
    setBusy(true);
    try {
      const r = await ordersApi.completePreparation(orderId, generalNotes || undefined);
      setPrep(r.prep);
      swalToast("Preparación completada");
    } catch (err) {
      swalError("No se pudo completar", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const markReady = async () => {
    setBusy(true);
    try {
      await ordersApi.updateStatus(orderId, "ready", "Listo para entrega");
      swalToast("Pedido marcado como listo");
      router.push("/admin/orders");
    } catch (err) {
      swalError("No se pudo marcar", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!prep) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
          <PackageCheck className="size-10 text-muted-foreground/50" />
          <div>
            <p className="font-medium">Preparación no iniciada</p>
            <p className="text-sm text-muted-foreground">Inicia la preparación para comenzar el timer y el check-list.</p>
          </div>
          <Button onClick={start} disabled={busy}>
            <Play className="size-4" /> Iniciar preparación
          </Button>
        </CardContent>
      </Card>
    );
  }

  const done = Boolean(prep.completedAt);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/orders")}>
          <ArrowLeft className="size-4" /> Pedidos
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageCheck className="size-4" /> Pedido #{prep.orderNumber}
            </CardTitle>
            <CardDescription>
              {ORDER_STATUS_LABELS[prep.status as keyof typeof ORDER_STATUS_LABELS] ?? prep.status}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {prep.employeeName && (
              <div className="flex items-center gap-2">
                <UserRound className="size-4 text-muted-foreground" />
                <span className="font-medium">{prep.employeeName}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-4" />
              <span className={cn("tabular-nums font-semibold", !done && "text-primary")}>
                {formatElapsed(elapsedSecs)}
              </span>
              {done && <Badge variant="secondary">Completada</Badge>}
            </div>
            {prep.generalNotes && (
              <p className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
                {prep.generalNotes}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Progreso</CardTitle>
            <CardDescription>
              {foundCount} de {totalItems} productos encontrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="h-3" />
            <div className="mt-1 text-right text-xs tabular-nums text-muted-foreground">{progress}%</div>
          </CardContent>
        </Card>
      </div>

      {!done && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2">
              <ScanLine className="size-4 text-muted-foreground" />
              <Input
                ref={scanRef}
                placeholder="Escanear o escribir producto… (Enter para marcar)"
                className="h-9"
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitScan();
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Timer className="size-4" /> Check-list de productos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-lg border">
            {prep.items.map((item) => (
              <li key={item.id} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    onClick={() => !done && toggleFound(item)}
                  >
                    {item.found ? (
                      <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
                    ) : (
                      <CircleDot className="size-5 shrink-0 text-muted-foreground/50" />
                    )}
                    <span className="min-w-0">
                      <span className={cn("block text-sm font-medium", item.found && "text-muted-foreground line-through")}>
                        {item.bulkQuantityDisplay ?? `${item.quantity} × ${item.productName}`}
                        {item.variantName && item.productName !== item.variantName ? ` (${item.variantName})` : ""}
                      </span>
                      {item.comment && (
                        <span className="block text-xs text-muted-foreground">Pedido: “{item.comment}”</span>
                      )}
                    </span>
                  </button>
                </div>
                {!done && (
                  <div className="mt-1.5 pl-7">
                    <Textarea
                      className="h-14 text-xs"
                      placeholder="Comentario del empleado (opcional)"
                      value={item.notes ?? ""}
                      onChange={(e) => saveNotes(item, e.target.value || null)}
                    />
                  </div>
                )}
                {done && item.notes && (
                  <p className="mt-1 pl-7 text-xs text-muted-foreground">Comentario: “{item.notes}”</p>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {!done ? (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <Textarea
              placeholder="Observación general (opcional)"
              rows={2}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => router.push("/admin/orders")}>
                Volver
              </Button>
              <Button onClick={complete} disabled={busy}>
                {busy ? "Guardando…" : "Completar preparación"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex justify-end">
          <Button onClick={markReady} disabled={busy || prep.status === "ready"}>
            {busy ? "Guardando…" : "Marcar pedido como listo"}
          </Button>
        </div>
      )}
    </div>
  );
}