"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Mail, Phone, Save, User } from "lucide-react";
import { settingsApi, type MyProfileView } from "@/lib/settings/client";
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads";
import { swalError, swalToast } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InputGroupField } from "@/components/base/input-group-field";
import { Attachment } from "@/components/base/attachment";

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
      <InputGroupField
        label="Nombre"
        leftIcon={<User className="size-4" />}
        value={form.fullName}
        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
      />
      <InputGroupField
        label="Email"
        helper="Se guarda en minúsculas."
        type="email"
        leftIcon={<Mail className="size-4" />}
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })}
      />
      <InputGroupField
        label="Teléfono"
        helper="Solo 10 dígitos."
        inputMode="numeric"
        leftIcon={<Phone className="size-4" />}
        value={form.phone ?? ""}
        onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
      />
      <Attachment
        label="Avatar"
        helper="Tu foto de perfil."
        value={form.avatarUrl ?? ""}
        onChange={(url) => setForm({ ...form, avatarUrl: url ?? "" })}
        upload={uploadFile}
        accept={UPLOAD_IMAGE_ACCEPT}
      />

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
