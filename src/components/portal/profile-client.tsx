"use client";

import { useEffect, useState } from "react";
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
  ShoppingCart,
  Receipt,
  Settings,
  Bell,
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
import { TapScale } from "@/components/shared/tap-scale";
import packageJson from "../../../package.json";
import { STAGGER_FADE_UP } from "@/lib/animation-tokens";

const { container, item } = STAGGER_FADE_UP;

interface ProfileStats {
  orders: number;
  points: number;
  favorites: number;
}

export function ProfileClient() {
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
      setShowEditForm(false);
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
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
      {/* Profile Header — Avatar + Name + Stats */}
      <motion.div variants={item} className="relative">
        <div className="flex flex-col items-center rounded-3xl border border-border/30 bg-card p-6 pb-5 shadow-sm">
          {/* Avatar */}
          <div className="relative">
            <div className="flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-primary via-primary/80 to-emerald-500 text-3xl font-bold text-primary-foreground shadow-xl shadow-primary/25 ring-4 ring-background">
              {customer.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={customer.imageUrl} alt="" className="size-full rounded-full object-cover" />
              ) : (
                initials
              )}
            </div>
          </div>

          {/* Name + @username */}
          <h1 className="mt-3 text-xl font-bold tracking-tight">{customer.fullName}</h1>
          {customer.email && (
            <p className="text-sm text-muted-foreground">@{customer.email.split("@")[0]}</p>
          )}

          {/* Stats row */}
          <div className="mt-5 flex w-full max-w-xs items-center justify-around">
            <StatItem value={stats.orders} label="Pedidos" />
            <div className="h-10 w-px bg-border/50" />
            <StatItem value={stats.points} label="Puntos" highlight />
            <div className="h-10 w-px bg-border/50" />
            <StatItem value={stats.favorites} label="Favoritos" />
          </div>
        </div>
      </motion.div>

      {/* Loyalty / Rewards Card */}
      <motion.div variants={item}>
        <Link href="/portal/loyalty" className="block">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-orange-500/10 border border-amber-500/20 p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
                <Sparkles className="size-5 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Puntos de Lealtad</p>
                <p className="text-xs text-muted-foreground">
                  {stats.points > 0
                    ? `${stats.points} puntos disponibles — canjea por descuentos`
                    : "Acumula puntos con cada compra"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-lg font-bold text-amber-500">{stats.points}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </Link>
      </motion.div>

      {/* Menu sections */}
      <motion.div variants={item} className="space-y-2">
        <ProfileMenuItem
          href="/portal/loyalty"
          icon={Sparkles}
          iconColor="text-amber-500 bg-amber-500/10"
          label="Puntos y lealtad"
        />
        <ProfileMenuItem
          href="/portal/favorites"
          icon={Heart}
          iconColor="text-rose-500 bg-rose-500/10"
          label="Favoritos"
          badge={stats.favorites > 0 ? stats.favorites : undefined}
        />
        <ProfileMenuItem
          href="/portal/payment-methods"
          icon={CreditCard}
          iconColor="text-blue-500 bg-blue-500/10"
          label="Métodos de pago"
        />
        <ProfileMenuItem
          href="/portal/orders"
          icon={Receipt}
          iconColor="text-emerald-500 bg-emerald-500/10"
          label="Mis pedidos"
          badge={stats.orders > 0 ? stats.orders : undefined}
        />
        <ProfileMenuItem
          href="/portal/notifications"
          icon={Bell}
          iconColor="text-violet-500 bg-violet-500/10"
          label="Notificaciones"
        />
        <button
          onClick={() => setShowEditForm(!showEditForm)}
          className="flex w-full items-center gap-3.5 rounded-xl border border-border/30 bg-card p-3.5 shadow-sm transition-colors hover:bg-muted/50"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-500 bg-slate-500/10">
            <Settings className="size-5" />
          </div>
          <span className="flex-1 text-left text-sm font-semibold">Configuración</span>
          <ChevronRight className={`size-4 text-muted-foreground transition-transform ${showEditForm ? "rotate-90" : ""}`} />
        </button>
      </motion.div>

      {/* Edit Form (collapsible) */}
      {showEditForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-3 rounded-2xl border border-border/30 bg-card p-4 shadow-sm overflow-hidden"
        >
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
          />
          <Button className="w-full h-11 rounded-xl font-semibold" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </motion.div>
      )}

      {/* Permisos */}
      <motion.div variants={item} className="rounded-2xl border border-border/30 bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Permisos de la aplicación</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Gestiona los permisos que usa la app para funcionalidades como ubicación, cámara y notificaciones.
        </p>
        <PortalPermissionsSection />
      </motion.div>

      {/* Nav customizer */}
      <motion.div variants={item} className="rounded-2xl border border-border/30 bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <LayoutGrid className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Personalizar navegación</h2>
        </div>
        <NavCustomizer />
      </motion.div>

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

      {/* Delete account */}
      <motion.div variants={item}>
        <DeleteAccountButton />
      </motion.div>

      {/* Version */}
      <motion.p variants={item} className="text-center text-[0.65rem] text-muted-foreground/50 pb-4">
        Sistema Multi-POS v{packageJson.version}
      </motion.p>
    </motion.div>
  );
}

/* ─── Stat Item ─── */
function StatItem({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-lg font-bold ${highlight ? "text-amber-500" : ""}`}>
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
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
    <TapScale>
      <Link
        href={href}
        className="flex items-center gap-3.5 rounded-xl border border-border/30 bg-card p-3.5 shadow-sm transition-colors hover:bg-muted/50"
      >
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${iconColor}`}>
          <Icon className="size-5" />
        </div>
        <span className="flex-1 text-sm font-semibold">{label}</span>
        {badge !== undefined && (
          <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>
    </TapScale>
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
