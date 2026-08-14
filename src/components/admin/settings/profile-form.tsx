"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Save } from "lucide-react";
import { settingsApi, type MyProfileView } from "@/lib/settings/client";
import { swalError, swalToast } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export function ProfileForm() {
  const [form, setForm] = useState<MyProfileView | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi
      .profile()
      .then((d) => setForm(d.profile))
      .catch(() => undefined);
  }, []);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const res = await settingsApi.updateProfile({
        fullName: form.fullName,
        phone: form.phone || null,
        email: form.email,
        avatarUrl: form.avatarUrl,
      });
      setForm(res.profile);
      swalToast("Perfil actualizado");
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Nombre</Label>
        <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Teléfono</Label>
        <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Avatar URL</Label>
        <Input value={form.avatarUrl ?? ""} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={saving}>
          <Save className="size-4" /> {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/auth/change-password">
            <KeyRound className="size-4" /> Cambiar contraseña
          </Link>
        </Button>
      </div>
    </div>
  );
}
