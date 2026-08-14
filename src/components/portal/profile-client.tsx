"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronRight, CreditCard, Heart, LogOut, Sparkles } from "lucide-react";
import { portalApi } from "@/lib/portal/client";
import type { PortalCustomer } from "@/lib/portal/server";
import { swalError, swalToast } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const LINKS = [
  { href: "/portal/loyalty", label: "Puntos y lealtad", icon: Sparkles },
  { href: "/portal/favorites", label: "Favoritos", icon: Heart },
  { href: "/portal/payment-methods", label: "Métodos de pago", icon: CreditCard },
];

export function ProfileClient() {
  const [customer, setCustomer] = useState<PortalCustomer | null>(null);
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", address: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    portalApi
      .profile()
      .then((d) => {
        if (!active) return;
        setCustomer(d.customer);
        setForm({
          fullName: d.customer.fullName,
          phone: d.customer.phone ?? "",
          email: d.customer.email ?? "",
          address: d.customer.address ?? "",
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await portalApi.updateProfile({
        fullName: form.fullName,
        phone: form.phone,
        email: form.email,
        address: form.address,
      });
      setCustomer(res.customer);
      swalToast("Perfil actualizado");
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  if (!customer) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <h1 className="text-lg font-semibold">Mi perfil</h1>

      <section className="space-y-3 rounded-xl border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="p-name">Nombre</Label>
          <Input id="p-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-phone">Teléfono</Label>
          <Input id="p-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-email">Email</Label>
          <Input id="p-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-addr">Dirección</Label>
          <Input id="p-addr" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </section>

      <section className="overflow-hidden rounded-xl border">
        {LINKS.map((l) => {
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-3 border-b p-3.5 text-sm font-medium last:border-b-0 hover:bg-muted/50"
            >
              <Icon className="size-4 text-primary" />
              {l.label}
              <ChevronRight className="ml-auto size-4 text-muted-foreground" />
            </Link>
          );
        })}
      </section>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => void signOut({ callbackUrl: "/auth/login" })}
      >
        <LogOut className="size-4" /> Cerrar sesión
      </Button>
    </div>
  );
}
