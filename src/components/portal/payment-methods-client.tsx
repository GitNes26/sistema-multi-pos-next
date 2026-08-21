"use client";

import { useEffect, useState } from "react";
import { Calendar, CreditCard, Hash, Plus, Star, Trash2, TriangleAlert, Wallet } from "lucide-react";
import { portalApi } from "@/lib/portal/client";
import type { ExpiringCardView, PaymentMethodView } from "@/lib/portal/server";
import { swalConfirm, swalError, swalToast } from "@/lib/swal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InputGroupField } from "@/components/base/input-group-field";
import { cn } from "@/lib/utils";

export function PaymentMethodsClient() {
  const [methods, setMethods] = useState<PaymentMethodView[] | null>(null);
  const [expiring, setExpiring] = useState<ExpiringCardView[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ alias: "", brand: "", last4: "", expMonth: "", expYear: "", isDefault: false });

  const load = () => {
    portalApi
      .paymentMethods()
      .then((d) => setMethods(d.methods))
      .catch(() => undefined);
    portalApi
      .expiringCards()
      .then((d) => setExpiring(d.cards))
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    const expMonth = Number(form.expMonth);
    const expYear = Number(form.expYear);
    if (!/^\d{4}$/.test(form.last4)) {
      swalError("Los últimos 4 dígitos son inválidos");
      return;
    }
    try {
      const res = await portalApi.addPaymentMethod({
        alias: form.alias,
        brand: form.brand || "card",
        last4: form.last4,
        expMonth,
        expYear,
        isDefault: form.isDefault,
      });
      setMethods(res.methods);
      setShowForm(false);
      setForm({ alias: "", brand: "", last4: "", expMonth: "", expYear: "", isDefault: false });
      swalToast("Tarjeta agregada");
    } catch (err) {
      swalError("No se pudo agregar", err instanceof Error ? err.message : undefined);
    }
  };

  const remove = async (id: string) => {
    const ok = await swalConfirm("Eliminar tarjeta", "¿Seguro que quieres eliminar este método de pago?", { danger: true });
    if (!ok) return;
    try {
      await portalApi.removePaymentMethod(id);
      setMethods((prev) => (prev ? prev.filter((m) => m.id !== id) : prev));
      swalToast("Tarjeta eliminada", "info");
    } catch (err) {
      swalError("No se pudo eliminar", err instanceof Error ? err.message : undefined);
    }
  };

  const setDefault = async (id: string) => {
    try {
      const res = await portalApi.setDefaultPaymentMethod(id);
      setMethods(res.methods);
      swalToast("Tarjeta predeterminada actualizada");
    } catch (err) {
      swalError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Métodos de pago</h1>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="size-4" /> Agregar
        </Button>
      </div>

      {expiring.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <p className="font-medium text-amber-700">Tarjetas por vencer</p>
            {expiring.map((c) => (
              <p key={c.id} className="text-xs text-amber-700/80">
                {c.alias ? `${c.alias} — ` : ""}
                {c.brand} •••• {c.last4} (exp. {String(c.expMonth).padStart(2, "0")}/{c.expYear})
              </p>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="space-y-3 rounded-xl border p-4">
          <InputGroupField
            label="Alias"
            helper="Ej. «Mi tarjeta de crédito», «Nómina»…"
            maxLength={40}
            leftIcon={<Wallet className="size-4" />}
            placeholder="Nombre para identificarla"
            value={form.alias}
            onChange={(e) => setForm({ ...form, alias: e.target.value })}
          />
          <InputGroupField
            label="Marca (opcional)"
            leftIcon={<CreditCard className="size-4" />}
            placeholder="Visa, Mastercard…"
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
          />
          <InputGroupField
            label="Últimos 4 dígitos"
            helper="Solo 4 dígitos."
            inputMode="numeric"
            leftIcon={<Hash className="size-4" />}
            maxLength={4}
            placeholder="4242"
            value={form.last4}
            onChange={(e) => setForm({ ...form, last4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          />
          <div className="grid grid-cols-2 gap-3">
            <InputGroupField
              label="Mes"
              type="number"
              min={1}
              max={12}
              leftIcon={<Calendar className="size-4" />}
              placeholder="MM"
              value={form.expMonth}
              onChange={(e) => setForm({ ...form, expMonth: e.target.value })}
            />
            <InputGroupField
              label="Año"
              type="number"
              leftIcon={<Calendar className="size-4" />}
              placeholder="YYYY"
              value={form.expYear}
              onChange={(e) => setForm({ ...form, expYear: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            />
            Establecer como predeterminada
          </label>
          <Button className="w-full" onClick={add}>
            Guardar tarjeta
          </Button>
        </div>
      )}

      {!methods ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : methods.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No tienes tarjetas guardadas</p>
      ) : (
        methods.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-xl border p-3">
            <div className="flex items-center gap-3">
              <CreditCard className="size-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {m.alias ? (
                    <>
                      {m.alias}{" "}
                      <span className="font-normal text-muted-foreground">
                        ({m.brand} •••• {m.last4})
                      </span>
                    </>
                  ) : (
                    <>
                      {m.brand} •••• {m.last4}
                    </>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Expira {String(m.expMonth).padStart(2, "0")}/{m.expYear}
                </p>
              </div>
              {m.isDefault && <Badge variant="secondary">Predeterminada</Badge>}
            </div>
            <div className="flex items-center gap-1">
              <button
                className={cn("p-1.5", m.isDefault ? "text-amber-500" : "text-muted-foreground hover:text-amber-500")}
                onClick={() => setDefault(m.id)}
                aria-label="Predeterminada"
              >
                <Star className={cn("size-4", m.isDefault && "fill-current")} />
              </button>
              <button className="p-1.5 text-muted-foreground hover:text-destructive" onClick={() => remove(m.id)} aria-label="Eliminar">
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
