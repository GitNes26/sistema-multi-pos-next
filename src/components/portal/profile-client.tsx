"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, CreditCard, Heart, LogOut, Mail, MapPin, Phone, Sparkles, User, LayoutGrid } from "lucide-react";
import { portalApi } from "@/lib/portal/client";
import { logout } from "@/lib/auth/logout";
import type { PortalCustomer } from "@/lib/portal/server";
import { swalError, swalToast } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InputGroupField } from "@/components/base/input-group-field";
import { NavCustomizer } from "@/components/portal/nav-customizer";

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
        <InputGroupField
          label="Nombre"
          leftIcon={<User className="size-4" />}
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        />
        <InputGroupField
          label="Teléfono"
          helper="Solo 10 dígitos."
          inputMode="numeric"
          leftIcon={<Phone className="size-4" />}
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
        />
        <InputGroupField
          label="Email"
          type="email"
          leftIcon={<Mail className="size-4" />}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })}
        />
        <InputGroupField
          label="Dirección"
          leftIcon={<MapPin className="size-4" />}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
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

      <section className="rounded-xl border p-4">
        <div className="mb-3 flex items-center gap-2">
          <LayoutGrid className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Personalizar barra de navegación</h2>
        </div>
        <NavCustomizer />
      </section>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => void logout()}
      >
        <LogOut className="size-4" /> Cerrar sesión
      </Button>
    </div>
  );
}
