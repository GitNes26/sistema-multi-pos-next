"use client"

import * as React from "react"
import * as yup from "yup"
import { AlertCircle, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DialogComponent } from "@/components/ui/dialog"
import { InputGroupField } from "@/components/base/input-group-field"
import { useFocusInvalid } from "@/hooks/use-focus-invalid"

// Editar los datos de un usuario: nombre, correo, teléfono y contraseña. Lo usan
// «Usuarios y permisos» (administrador de la empresa) y «Organizaciones y roles»
// (superadmin); cada uno aporta su endpoint con `onSave`.

export type EditableUser = { fullName: string; email: string; phone?: string | null }
export type EditUserPayload = { fullName: string; email: string; phone: string; password?: string }

export function EditUserDialog({
  user,
  onClose,
  onSave,
  credentialsNote,
}: {
  user: EditableUser | null
  onClose: () => void
  /** Guarda los cambios; si lanza, el mensaje se muestra en el diálogo. */
  onSave: (payload: EditUserPayload) => Promise<void>
  /** Aviso bajo el correo/contraseña (p. ej. quién ve cerrada su sesión). */
  credentialsNote?: string
}) {
  const [fullName, setFullName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState<string>()
  const [saving, setSaving] = React.useState(false)
  const { focusFirstEnabled, focusFirstInvalid } = useFocusInvalid()

  React.useEffect(() => {
    if (!user) return
    setFullName(user.fullName)
    setEmail(user.email)
    setPhone(user.phone ?? "")
    setPassword("")
    setConfirm("")
    setErrors({})
    setFormError(undefined)
    const frame = window.requestAnimationFrame(() => focusFirstEnabled("edit-user-form"))
    return () => window.cancelAnimationFrame(frame)
  }, [user, focusFirstEnabled])

  if (!user) return null

  const save = async () => {
    try {
      await yup
        .object({
          fullName: yup.string().trim().required("El nombre es obligatorio").max(160, "Máximo 160 caracteres"),
          email: yup.string().trim().lowercase().email("Ingresa un correo válido").required("El correo es obligatorio"),
          phone: yup.string().trim().matches(/^$|^[\d\s()+-]{7,20}$/, "Teléfono inválido"),
          password: yup.string().test("min", "La contraseña debe tener al menos 8 caracteres", (v) => !v || v.length >= 8),
          confirm: yup.string().test("same", "Las contraseñas no coinciden", (v) => (v ?? "") === password),
        })
        .validate({ fullName, email, phone, password, confirm }, { abortEarly: false })
      setErrors({})
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const next: Record<string, string> = {}
        for (const failure of error.inner) if (failure.path && !next[failure.path]) next[failure.path] = failure.message
        setErrors(next)
        const focusErrors = Object.fromEntries(Object.entries(next).map(([key, message]) => [`edit-user-${key}`, message]))
        window.requestAnimationFrame(() => focusFirstInvalid(focusErrors, "edit-user-form"))
      }
      return
    }
    setSaving(true)
    setFormError(undefined)
    try {
      await onSave({ fullName: fullName.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), password: password || undefined })
      onClose()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open
      onOpenChange={(v) => !v && onClose()}
      title="Editar usuario"
      description={`Datos de acceso de ${user.fullName}.`}
      icon={<UserRound className="size-4" />}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="edit-user-form" disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </>
      }
    >
      <form
        id="edit-user-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
        className="space-y-3"
      >
        {formError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {formError}
          </div>
        )}
        <InputGroupField id="edit-user-fullName" label="Nombre completo" required value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.fullName} />
        <InputGroupField id="edit-user-email" label="Correo" type="email" required value={email} onChange={(e) => setEmail(e.target.value.toLowerCase())} error={errors.email} />
        <InputGroupField id="edit-user-phone" label="Teléfono" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
        <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Contraseña nueva: déjala vacía para conservar la actual.</p>
          <InputGroupField id="edit-user-password" label="Contraseña nueva" type="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
          <InputGroupField id="edit-user-confirm" label="Repetir contraseña" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
        </div>
        {credentialsNote && <p className="text-xs text-muted-foreground">{credentialsNote}</p>}
      </form>
    </DialogComponent>
  )
}
