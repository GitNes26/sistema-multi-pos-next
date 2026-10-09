"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { ArrowRight, CheckCircle2, Loader2, Mail, MapPin, Phone, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InputGroupField } from "@/components/base/input-group-field"
import { Attachment } from "@/components/base/attachment"
import { useFocusInvalid } from "@/hooks/use-focus-invalid"

const schema = yup.object({
  fullName: yup.string().trim().min(3, "Escribe tu nombre completo").required("Escribe tu nombre completo"),
  phone: yup
    .string()
    .required("Escribe tu teléfono")
    .test("len", "Escribe un teléfono de 10 dígitos", (v) => (v ?? "").replace(/\D/g, "").length >= 10),
  email: yup.string().trim().email("Escribe un correo válido").required("Escribe tu correo"),
  address: yup.string().trim().max(250).optional(),
})
type Values = yup.InferType<typeof schema>

/** Alta de cliente desde el login del portal: la cuenta sirve para todos los negocios. */
export function RegisterForm() {
  const [photo, setPhoto] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { focusFirstInvalid } = useFocusInvalid()
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<Values>({
    resolver: yupResolver(schema),
    defaultValues: { fullName: "", phone: "", email: "", address: "" },
  })
  useEffect(() => {
    const frame = requestAnimationFrame(() => setFocus("fullName"))
    return () => cancelAnimationFrame(frame)
  }, [setFocus])

  const onSubmit = handleSubmit(
    async (values) => {
      setLoading(true)
      setError(null)
      try {
        const body = new FormData()
        for (const [k, v] of Object.entries(values)) if (v) body.append(k, String(v))
        if (photo) body.append("photo", photo)
        const res = await fetch("/api/portal/register", { method: "POST", body })
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string }
        if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo crear la cuenta")
        setDone(data.message ?? "Revisa tu correo para activar tu cuenta.")
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo crear la cuenta")
      } finally {
        setLoading(false)
      }
    },
    (invalid) => requestAnimationFrame(() => focusFirstInvalid(Object.fromEntries(Object.entries(invalid).map(([k, v]) => [k, String(v?.message ?? "")])), "register-form"))
  )

  if (done) {
    return (
      <div className="space-y-4 py-6 text-center">
        <CheckCircle2 className="mx-auto size-12 text-success" />
        <h1 className="text-2xl font-bold">¡Cuenta creada!</h1>
        <p className="text-sm text-muted-foreground">{done}</p>
        <p className="text-sm text-muted-foreground">Al entrar podrás elegir el negocio al que quieres comprar.</p>
        <Button asChild className="h-12 w-full rounded-xl">
          <Link href="/portal/auth/login">Ir a iniciar sesión</Link>
        </Button>
      </div>
    )
  }

  return (
    <form id="register-form" onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <h1 className="text-2xl font-bold">Crear cuenta</h1>
        <p className="text-sm text-muted-foreground">Una sola cuenta para todos los negocios. Tu número de cliente se asigna en cada uno.</p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <InputGroupField id="fullName" label="Nombre completo" required leftIcon={<UserRound className="size-4" />} autoComplete="name" error={errors.fullName?.message} {...register("fullName")} />
      <InputGroupField id="phone" label="Teléfono" required type="tel" leftIcon={<Phone className="size-4" />} autoComplete="tel" error={errors.phone?.message} {...register("phone")} />
      <InputGroupField id="email" label="Correo electrónico" required type="email" leftIcon={<Mail className="size-4" />} autoComplete="email" helper="Te enviaremos el enlace para activar tu cuenta." error={errors.email?.message} {...register("email")} />
      <InputGroupField id="address" label="Dirección (opcional)" leftIcon={<MapPin className="size-4" />} autoComplete="street-address" error={errors.address?.message} {...register("address")} />
      <Attachment label="Foto (opcional)" accept="image/jpeg,image/png,image/webp" onFileChange={setPhoto} widthClass="w-32" heightClass="h-32" />
      <Button type="submit" className="h-12 w-full rounded-xl text-base font-semibold" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="animate-spin" /> Creando…
          </>
        ) : (
          <>
            Crear cuenta <ArrowRight className="size-4" />
          </>
        )}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/portal/auth/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  )
}
