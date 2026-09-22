"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ChevronRight,
  CreditCard,
  Heart,
  LogOut,
  Mail,
  Phone,
  Shield,
  Sparkles,
  User,
  LayoutGrid,
  Trash2,
  Receipt,
  Settings,
  FileText,
  IdCard,
  KeyRound,
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

  return (
    <motion.div
      className="space-y-4 p-4"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* ── Header ──────────────────────────────────── */}
      <motion.div variants={item}><h1 className="text-2xl font-bold tracking-tight">Mi perfil</h1><p className="text-sm text-muted-foreground">Tus datos, seguridad y preferencias.</p></motion.div>

      {/* ── Avatar Card ─────────────────────────────── */}
      <motion.div variants={item}>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary/20 bg-primary/5">
                  {customer.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={customer.imageUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-bold text-primary">{initials}</span>
                  )}
            </div>
            <div className="min-w-0 flex-1"><h2 className="truncate text-lg font-bold">{customer.fullName}</h2>{customer.email && <p className="truncate text-sm text-muted-foreground">{customer.email}</p>}</div>
          </div>
            {customer.customerCode && (
              <p className="mt-3 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-muted px-3 text-xs font-semibold text-muted-foreground">
                <IdCard className="size-3.5" aria-hidden="true" />
                Núm. de cliente: {customer.customerCode}
              </p>
            )}

            <div className="mt-4 flex w-full items-center justify-around border-t pt-4">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-lg font-bold">
                  <AnimatedNumber value={stats.orders} duration={0.6} />
                </span>
                <span className="text-xs text-muted-foreground">Pedidos</span>
              </div>
              <div className="h-10 w-px bg-border/50" />
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-lg font-bold text-amber-500">
                  <AnimatedNumber value={stats.points} duration={0.6} />
                </span>
                <span className="text-xs text-muted-foreground">Puntos</span>
              </div>
              <div className="h-10 w-px bg-border/50" />
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-lg font-bold">
                  <AnimatedNumber value={stats.favorites} duration={0.6} />
                </span>
                <span className="text-xs text-muted-foreground">Favoritos</span>
              </div>
            </div>
        </div>
      </motion.div>

      {/* ── Credit / Balance Card ───────────────────── */}
      <motion.div variants={item}>
        <Link href="/portal/credit" className="block">
          <div className="rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40">
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-background/80 shadow-sm">
                <CreditCard className="size-5 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Mi crédito</p>
                <p className="text-xs text-muted-foreground">Consulta saldo, adeudos y abonos</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 rounded-full bg-background/80 px-3 py-1.5 text-xs font-semibold shadow-sm">
                Ver detalle
                <ChevronRight className="size-3.5" />
              </div>
            </div>
          </div>
        </Link>
      </motion.div>

      <motion.section variants={item} className="space-y-2"><h2 className="px-1 text-sm font-semibold">Tu actividad</h2><div className="grid grid-cols-2 gap-2">
        {([{ href: "/portal/orders", icon: Receipt, label: "Pedidos" }, { href: "/portal/favorites", icon: Heart, label: "Favoritos" }, { href: "/portal/loyalty", icon: Sparkles, label: "Puntos" }, { href: "/portal/payment-methods", icon: FileText, label: "Métodos de pago" }] as const).map(({ href, icon: Icon, label }) => <Link key={href} href={href} className="flex min-h-16 items-center gap-2 rounded-xl border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-primary"><Icon className="size-5 shrink-0 text-primary" />{label}</Link>)}
      </div></motion.section>

      {/* ── Settings Section ────────────────────────── */}
      <motion.div variants={item} className="space-y-2">
        <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Configuración
        </p>
        <button
          onClick={() => { setShowEditForm(!showEditForm); if (!showEditForm) requestAnimationFrame(() => nameRef.current?.focus()); }}
          aria-expanded={showEditForm}
          aria-controls="profile-edit-form"
          className="flex min-h-14 w-full items-center gap-3.5 rounded-2xl border border-border/30 bg-card p-4 shadow-sm transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/60">
            <Settings className="size-5 text-muted-foreground" />
          </div>
          <span className="flex-1 text-left text-sm font-semibold">Editar perfil</span>
          <ChevronRight className={`size-4 text-muted-foreground transition-transform ${showEditForm ? "rotate-90" : ""}`} />
        </button>
        <ProfileMenuItem href="/portal/change-password" icon={KeyRound} iconColor="text-blue-600 bg-blue-600/10" label="Cambiar contraseña" />
        <button
          onClick={() => setShowNavigation(!showNavigation)}
          aria-expanded={showNavigation}
          aria-controls="nav-customizer-panel"
          className="flex min-h-14 w-full items-center gap-3.5 rounded-2xl border border-border/30 bg-card p-4 shadow-sm transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/60">
            <LayoutGrid className="size-5 text-muted-foreground" />
          </div>
          <span className="flex-1 text-left text-sm font-semibold">Personalizar navegación</span>
          <ChevronRight className={`size-4 text-muted-foreground transition-transform ${showNavigation ? "rotate-90" : ""}`} />
        </button>
        <button
          onClick={() => setShowPermissions(!showPermissions)}
          aria-expanded={showPermissions}
          aria-controls="profile-permissions-panel"
          className="flex min-h-14 w-full items-center gap-3.5 rounded-2xl border border-border/30 bg-card p-4 shadow-sm transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/60"><Shield className="size-5 text-muted-foreground" /></div>
          <span className="flex-1 text-left text-sm font-semibold">Permisos de la aplicación</span>
          <ChevronRight className={`size-4 text-muted-foreground transition-transform ${showPermissions ? "rotate-90" : ""}`} />
        </button>
      </motion.div>

      {/* ── Edit Form (collapsible) ─────────────────── */}
      {showEditForm && (
        <motion.form
          id="profile-edit-form"
          onSubmit={(event) => { event.preventDefault(); void save(); }}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-3 rounded-2xl border border-border/30 bg-card p-4 shadow-sm overflow-hidden"
        >
          <div className="flex items-center gap-2 mb-1">
            <User className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Datos personales</h2>
          </div>
          {formError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{formError}</p>}
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
          <Button type="submit" className="w-full h-11 rounded-xl font-semibold" disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </motion.form>
      )}

      {/* ── Nav Customizer ──────────────────────────── */}
      {showNavigation && <motion.div variants={item} id="nav-customizer-panel" className="rounded-2xl border border-border/30 bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <LayoutGrid className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Personalizar navegación</h2>
        </div>
        <NavCustomizer canReserve={canReserve} />
      </motion.div>}

      {/* ── Permissions ─────────────────────────────── */}
      {showPermissions && <motion.div variants={item} id="profile-permissions-panel" className="rounded-2xl border border-border/30 bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Permisos de la aplicación</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Gestiona los permisos que usa la app para funcionalidades como ubicación, cámara y notificaciones.
        </p>
        <PortalPermissionsSection />
      </motion.div>}

      {/* ── Logout ──────────────────────────────────── */}
      <motion.div variants={item}>
        <Button
          variant="outline"
          className="w-full h-11 rounded-xl"
          onClick={() => void logout()}
        >
          <LogOut className="size-4" /> Cerrar sesión
        </Button>
      </motion.div>

      {/* ── Delete account ──────────────────────────── */}
      <motion.div variants={item}>
        <DeleteAccountButton />
      </motion.div>

      {/* ── Version ─────────────────────────────────── */}
      <motion.p variants={item} className="text-center text-xs text-muted-foreground/50 pb-4">
        Sistema Multi-POS v{packageJson.version}
      </motion.p>
    </motion.div>
  );
}

/* ─── Profile Menu Item ─── */
function ProfileMenuItem({
  href,
  icon: Icon,
  iconColor,
  label,
  badge,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  label: string;
  badge?: number;
}) {
  return (
      <Link
        href={href}
        className="flex min-h-14 items-center gap-3.5 rounded-2xl border border-border/30 bg-card p-4 shadow-sm transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary"
      >
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${iconColor}`}>
          <Icon className="size-5" />
        </div>
        <span className="flex-1 text-sm font-semibold">{label}</span>
        {badge !== undefined && (
          <span className="flex min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>
  );
}

/* ─── Delete Account Button ─── */
function DeleteAccountButton() {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    const ok = await swalConfirm(
      "Eliminar mi cuenta",
      "Esta acción es permanente. Se eliminarán tus datos, pedidos serán anonimizados y tu acceso será revocado."
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
    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <Trash2 className="mt-0.5 size-4 text-destructive" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-destructive">Eliminar cuenta</p>
          <p className="text-xs text-muted-foreground">
            No puedes eliminar tu cuenta si tienes deuda pendiente, pedidos activos o devoluciones en proceso.
          </p>
        </div>
      </div>
      <Button
        variant="destructive"
        className="mt-3 w-full h-10 rounded-xl text-sm"
        onClick={handleDelete}
        disabled={deleting}
      >
        {deleting ? "Eliminando…" : "Eliminar mi cuenta permanentemente"}
      </Button>
    </div>
  );
}
