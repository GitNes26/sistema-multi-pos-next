"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ChevronRight,
  CreditCard,
  Heart,
  IdCard,
  KeyRound,
  Landmark,
  LayoutGrid,
  LogOut,
  Mail,
  Phone,
  Receipt,
  ScanLine,
  Shield,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { portalApi } from "@/lib/portal/client";
import { logout } from "@/lib/auth/logout";
import type { PortalCustomer } from "@/lib/portal/server";
import { swalConfirm, swalError, swalToast } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InputGroupField } from "@/components/base/input-group-field";
import { AddressField } from "@/components/base/address-field";
import { NavCustomizer } from "@/components/portal/nav-customizer";
import { PortalPermissionsSection } from "@/components/portal/portal-permissions-section";
import { AnimatedNumber } from "@/components/base/animated-number";
import { BottomSheet } from "@/components/portal/bottom-sheet";
import { CustomerQr } from "@/components/portal/customer-qr";
import { cn } from "@/lib/utils";
import packageJson from "../../../package.json";
import { STAGGER_FADE_UP } from "@/lib/animation-tokens";

const { container, item } = STAGGER_FADE_UP;

interface ProfileStats {
  orders: number;
  points: number;
  favorites: number;
}

export function ProfileClient({ canReserve = false }: { canReserve?: boolean }) {
  const [customer, setCustomer] = useState<PortalCustomer | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    address: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProfileStats>({ orders: 0, points: 0, favorites: 0 });
  const [showEditForm, setShowEditForm] = useState(false);
  const [showNavigation, setShowNavigation] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileData, ordersData, loyaltyData, favoritesData] = await Promise.allSettled([
        portalApi.profile(),
        portalApi.listOrders(),
        portalApi.loyalty(),
        portalApi.favorites(),
      ]);

      if (profileData.status === "fulfilled") {
        const d = profileData.value;
        setCustomer(d.customer);
        setForm({
          fullName: d.customer.fullName,
          phone: d.customer.phone ?? "",
          email: d.customer.email ?? "",
          address: d.customer.address ?? "",
          latitude: d.customer.latitude,
          longitude: d.customer.longitude,
        });
      }

      setStats({
        orders: ordersData.status === "fulfilled" ? ordersData.value.orders.length : 0,
        points: loyaltyData.status === "fulfilled" ? loyaltyData.value.points : 0,
        favorites: favoritesData.status === "fulfilled" ? favoritesData.value.variantIds.length : 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el perfil.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (window.location.hash === "#nav-customizer") setShowNavigation(true);
  }, []);

  const save = async () => {
    setFormError(null);
    if (!form.fullName.trim()) { setFormError("Escribe tu nombre para continuar."); nameRef.current?.focus(); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setFormError("Revisa el correo electrónico."); document.querySelector<HTMLInputElement>("#profile-email")?.focus(); return; }
    if (form.phone && form.phone.length !== 10) { setFormError("El teléfono debe tener 10 dígitos."); document.querySelector<HTMLInputElement>("#profile-phone")?.focus(); return; }
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
      setShowEditForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar el perfil");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-44 w-full rounded-3xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (error && !customer) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </span>
        <h1 className="text-lg font-bold">No se pudo cargar el perfil</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
        <Button onClick={fetchProfile} variant="outline" className="mt-2">
          Reintentar
        </Button>
      </div>
    );
  }

  if (!customer) return null;

  const initials = customer.fullName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const contactLine = [customer.phone, customer.email].filter(Boolean).join(" · ") || "Agrega tu teléfono y correo";

  return (
    <motion.div
      className="space-y-6 p-4 pb-8"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* ── Identidad + QR de cliente ───────────────── */}
      <motion.section variants={item} className="rounded-3xl border bg-card p-4">
        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/12 ring-2 ring-primary/15">
            {customer.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={customer.imageUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-lg font-bold text-primary">{initials}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading text-xl font-semibold tracking-tight">{customer.fullName}</h1>
            {customer.email && <p className="truncate text-sm text-muted-foreground">{customer.email}</p>}
            {customer.customerCode && (
              <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular">
                <IdCard className="size-3.5" aria-hidden="true" />
                {customer.customerCode}
              </p>
            )}
          </div>
          <CustomerQr
            customerId={customer.id}
            fullName={customer.fullName}
            customerCode={customer.customerCode}
            className="size-20"
          />
        </div>

        <p className="mt-3 flex items-start gap-2 rounded-xl bg-surface-sunken px-3 py-2 text-xs text-muted-foreground">
          <ScanLine className="mt-px size-3.5 shrink-0 text-primary" />
          Toca tu QR y muéstralo en caja: tu compra queda a tu nombre y sumas puntos.
        </p>

        <dl className="mt-4 grid grid-cols-3 divide-x border-t pt-4 text-center">
          {([
            ["Pedidos", stats.orders, "text-foreground"],
            ["Puntos", stats.points, "text-primary"],
            ["Favoritos", stats.favorites, "text-foreground"],
          ] as const).map(([label, value, tone]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dd className={cn("text-xl font-bold tracking-tight tabular", tone)}>
                <AnimatedNumber value={value} duration={0.6} />
              </dd>
              <dt className="text-xs text-muted-foreground">{label}</dt>
            </div>
          ))}
        </dl>
      </motion.section>

      {/* ── Actividad ───────────────────────────────── */}
      <motion.div variants={item}>
        <SettingsGroup title="Tu actividad">
          <SettingsRow href="/portal/orders" icon={Receipt} label="Mis pedidos" value={stats.orders ? String(stats.orders) : undefined} />
          <SettingsRow href="/portal/favorites" icon={Heart} label="Favoritos" value={stats.favorites ? String(stats.favorites) : undefined} />
          <SettingsRow href="/portal/loyalty" icon={Sparkles} label="Puntos y recompensas" />
          <SettingsRow href="/portal/credit" icon={Landmark} label="Mi crédito" description="Saldo, adeudos y abonos" />
          <SettingsRow href="/portal/payment-methods" icon={CreditCard} label="Métodos de pago" />
        </SettingsGroup>
      </motion.div>

      {/* ── Cuenta ──────────────────────────────────── */}
      <motion.div variants={item}>
        <SettingsGroup title="Cuenta">
          <SettingsRow
            icon={User}
            label="Datos personales"
            description={contactLine}
            onClick={() => {
              setFormError(null);
              setShowEditForm(true);
            }}
          />
          <SettingsRow href="/portal/change-password" icon={KeyRound} label="Cambiar contraseña" />
        </SettingsGroup>
      </motion.div>

      {/* ── Preferencias ────────────────────────────── */}
      <motion.div variants={item}>
        <SettingsGroup title="Preferencias">
          <SettingsRow
            icon={LayoutGrid}
            label="Personalizar navegación"
            description="Elige qué aparece en la barra inferior"
            onClick={() => setShowNavigation(true)}
          />
          <SettingsRow
            icon={Shield}
            label="Permisos de la app"
            description="Ubicación y notificaciones"
            onClick={() => setShowPermissions(true)}
          />
        </SettingsGroup>
      </motion.div>

      {/* ── Sesión ──────────────────────────────────── */}
      <motion.div variants={item}>
        <SettingsGroup>
          <SettingsRow icon={LogOut} label="Cerrar sesión" onClick={() => void logout()} chevron={false} />
          <DeleteAccountRow />
        </SettingsGroup>
      </motion.div>

      <motion.p variants={item} className="text-center text-xs text-muted-foreground/70">
        Sistema Multi-POS v{packageJson.version}
      </motion.p>

      {/* ── Hojas inferiores ────────────────────────── */}
      <BottomSheet
        open={showEditForm}
        onOpenChange={setShowEditForm}
        title="Datos personales"
        description="Se usan para tus pedidos y entregas."
        height="auto"
        maxHeight="92dvh"
        className="max-w-md"
        footer={
          <Button type="submit" form="profile-edit-form" className="h-12 w-full rounded-xl font-semibold" disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        }
      >
        <form
          id="profile-edit-form"
          onSubmit={(event) => { event.preventDefault(); void save(); }}
          className="space-y-3 pt-1"
        >
          {formError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{formError}</p>}
          <InputGroupField
            ref={nameRef}
            id="profile-name"
            label="Nombre"
            required
            leftIcon={<User className="size-4" />}
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <InputGroupField
            id="profile-phone"
            label="Teléfono"
            helper="Solo 10 dígitos."
            inputMode="numeric"
            leftIcon={<Phone className="size-4" />}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
          />
          <InputGroupField
            id="profile-email"
            label="Correo electrónico"
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
          />
        </form>
      </BottomSheet>

      <BottomSheet
        open={showNavigation}
        onOpenChange={setShowNavigation}
        title="Personalizar navegación"
        description="Ordena y elige las secciones de la barra inferior."
        height="auto"
        maxHeight="92dvh"
        className="max-w-md"
      >
        <NavCustomizer canReserve={canReserve} />
      </BottomSheet>

      <BottomSheet
        open={showPermissions}
        onOpenChange={setShowPermissions}
        title="Permisos de la app"
        description="Actívalos solo si los necesitas; también te los pediremos en el momento en que se usen."
        height="auto"
        maxHeight="92dvh"
        className="max-w-md"
      >
        <PortalPermissionsSection />
      </BottomSheet>
    </motion.div>
  );
}

/* ─── Lista de ajustes estilo nativo ─── */
function SettingsGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      {title && <h2 className="px-1 text-sm font-semibold text-muted-foreground">{title}</h2>}
      <div className="divide-y overflow-hidden rounded-2xl border bg-card">{children}</div>
    </section>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  description,
  value,
  href,
  onClick,
  chevron = true,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  value?: string;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
  tone?: "default" | "destructive";
}) {
  const content = (
    <>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          tone === "destructive" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
        )}
      >
        <Icon className="size-[1.1rem]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-medium", tone === "destructive" && "text-destructive")}>{label}</span>
        {description && <span className="block truncate text-xs text-muted-foreground">{description}</span>}
      </span>
      {value && <span className="text-sm text-muted-foreground tabular">{value}</span>}
      {chevron && <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" />}
    </>
  );
  const rowClass =
    "flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors outline-none hover:bg-muted/50 active:bg-muted focus-visible:bg-muted";
  if (href) {
    return (
      <Link href={href} className={rowClass}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={rowClass}>
      {content}
    </button>
  );
}

/* ─── Eliminar cuenta ─── */
function DeleteAccountRow() {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (deleting) return;
    const ok = await swalConfirm(
      "Eliminar mi cuenta",
      "Esta acción es permanente: se eliminan tus datos, tus pedidos se anonimizan y pierdes el acceso. No es posible si tienes deuda pendiente, pedidos activos o devoluciones en proceso."
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await portalApi.deleteProfile();
      if (res.ok) {
        swalToast("Cuenta eliminada. Redirigiendo…");
        setTimeout(() => {
          window.location.href = "/portal/auth/login";
        }, 1500);
      }
    } catch (err) {
      swalError(
        "No se pudo eliminar la cuenta",
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsRow
      icon={Trash2}
      label={deleting ? "Eliminando…" : "Eliminar mi cuenta"}
      description="Permanente; no se puede deshacer"
      tone="destructive"
      chevron={false}
      onClick={() => void handleDelete()}
    />
  );
}
