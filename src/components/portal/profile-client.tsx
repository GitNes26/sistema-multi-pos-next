"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, CreditCard, Heart, LogOut, Mail, MapPin, Phone, Shield, Sparkles, User, LayoutGrid } from "lucide-react";
import { portalApi } from "@/lib/portal/client";
import { logout } from "@/lib/auth/logout";
import type { PortalCustomer } from "@/lib/portal/server";
import { swalError, swalToast } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InputGroupField } from "@/components/base/input-group-field";
import { AddressField } from "@/components/base/address-field";
import { NavCustomizer } from "@/components/portal/nav-customizer";
import { PortalPermissionsSection } from "@/components/portal/portal-permissions-section";
import { TapScale } from "@/components/shared/tap-scale";
import packageJson from "../../../package.json";

const LINKS = [
  { href: "/portal/loyalty", label: "Puntos y lealtad", icon: Sparkles, color: "text-amber-500 bg-amber-500/10" },
  { href: "/portal/favorites", label: "Favoritos", icon: Heart, color: "text-rose-500 bg-rose-500/10" },
  { href: "/portal/payment-methods", label: "Métodos de pago", icon: CreditCard, color: "text-blue-500 bg-blue-500/10" },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export function ProfileClient() {
  const [customer, setCustomer] = useState<PortalCustomer | null>(null);
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", address: "", latitude: null as number | null, longitude: null as number | null });
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
          latitude: d.customer.latitude,
          longitude: d.customer.longitude,
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
        latitude: form.latitude,
        longitude: form.longitude,
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
      <div className="space-y-4 p-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  const initials = customer.fullName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <motion.div
      className="space-y-5 p-4"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Avatar hero */}
      <motion.div
        variants={item}
        className="flex flex-col items-center rounded-2xl border border-border/50 bg-card p-6 shadow-sm"
      >
        <div className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/20">
          {initials}
        </div>
        <h1 className="mt-3 text-lg font-bold">{customer.fullName}</h1>
        {customer.email && (
          <p className="text-sm text-muted-foreground">{customer.email}</p>
        )}
        {customer.phone && (
          <p className="text-xs text-muted-foreground/70">Tel: {customer.phone}</p>
        )}
      </motion.div>

      {/* Quick links */}
      <motion.div variants={item} className="space-y-2">
        {LINKS.map((l) => {
          const Icon = l.icon;
          return (
            <TapScale key={l.href}>
              <Link
                href={l.href}
                className="flex items-center gap-3.5 rounded-xl border border-border/50 bg-card p-3.5 shadow-sm"
              >
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${l.color}`}>
                  <Icon className="size-5" />
                </div>
                <span className="flex-1 text-sm font-semibold">{l.label}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            </TapScale>
          );
        })}
      </motion.div>

      {/* Edit form */}
      <motion.section variants={item} className="space-y-3 rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <User className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Datos personales</h2>
        </div>
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
        <AddressField
          address={form.address}
          onAddressChange={(address) => setForm({ ...form, address })}
          latitude={form.latitude}
          longitude={form.longitude}
          onGpsChange={(gps) => setForm({ ...form, latitude: gps?.lat ?? null, longitude: gps?.lon ?? null })}
          className="sm:col-span-2"
        />
        <Button className="w-full h-11 rounded-xl font-semibold" onClick={save} disabled={saving}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </motion.section>

      {/* Nav customizer */}
      <motion.section variants={item} className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <LayoutGrid className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Personalizar navegación</h2>
        </div>
        <NavCustomizer />
      </motion.section>

      {/* Permisos */}
      <motion.section variants={item} className="space-y-3 rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Permisos de la aplicación</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Gestiona los permisos que usa la app para funcionalidades como ubicación, cámara y notificaciones.
        </p>
        <PortalPermissionsSection />
      </motion.section>

      {/* Logout */}
      <motion.div variants={item}>
        <Button
          variant="outline"
          className="w-full h-11 rounded-xl"
          onClick={() => void logout()}
        >
          <LogOut className="size-4" /> Cerrar sesión
        </Button>
      </motion.div>

      {/* Version */}
      <motion.p variants={item} className="text-center text-[0.65rem] text-muted-foreground/50">
        Sistema Multi-POS v{packageJson.version}
      </motion.p>
    </motion.div>
  );
}
