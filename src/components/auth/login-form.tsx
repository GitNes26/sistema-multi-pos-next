"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { motion } from "framer-motion"
import { Eye, EyeOff, Loader2, Lock, User, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InputGroupField } from "@/components/base/input-group-field"
import { Logo } from "@/components/layout/logo"
import { cn } from "@/lib/utils"

const validationSchema = yup.object({
  identifier: yup.string().required("Correo o código requerido").min(3, "Demasiado corto"),
  password: yup.string().required("Contraseña requerida").min(6, "Mínimo 6 caracteres"),
})

type LoginValues = yup.InferType<typeof validationSchema>

const DEMO_ACCOUNTS = [
  { label: "Cliente demo", identifier: "cli-001@portal.local", password: "demo1234" },
]

export function LoginForm({
  mode,
  callbackUrl,
  error: nextAuthError,
}: {
  mode: "pos" | "portal"
  callbackUrl?: string | null
  error?: string | null
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginValues>({
    resolver: yupResolver(validationSchema),
    defaultValues: { identifier: "", password: "" },
  })

  async function runLogin(identifier: string, password: string) {
    setLoading(true)
    setError(null)
    const res = await signIn("credentials", {
      identifier,
      password,
      redirect: false,
      callbackUrl: callbackUrl ?? undefined,
    })
    setLoading(false)
    if (res?.error) {
      setError("Credenciales incorrectas o usuario inactivo.")
      return
    }
    if (res?.url) router.push(res.url)
    else router.refresh()
  }

  function onSubmit(values: LoginValues) {
    void runLogin(values.identifier, values.password)
  }

  const isPortal = mode === "portal"

  return (
    <div className="w-full max-w-sm">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {/* Hero icon */}
        <motion.div
          className="mx-auto mb-6"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
        >
          <Logo size={32} className="rounded-2xl shadow-lg shadow-primary/25" />
        </motion.div>

        <motion.h1
          className="mb-1 text-center text-xl font-bold"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {isPortal ? "Bienvenido" : "Multi-POS"}
        </motion.h1>
        <motion.p
          className="mb-6 text-center text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          {isPortal
            ? "Ingresa para hacer pedidos y ganar puntos"
            : "Punto de venta multi-sucursal"}
        </motion.p>

        {/* Form card */}
        <motion.div
          className="rounded-2xl border border-border/50 bg-card/80 p-5 shadow-lg shadow-black/5 backdrop-blur-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {(error ?? nextAuthError) && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription className="text-sm">
                {error ?? "No se pudo iniciar sesión. Revisa tus credenciales."}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <InputGroupField
              id="identifier"
              label="Correo o código"
              leftIcon={<User className="size-4" />}
              autoComplete="username"
              placeholder={isPortal ? "correo o nº de cliente" : "correo o nº de nómina"}
              className="h-12 text-base rounded-xl"
              error={errors.identifier?.message}
              {...register("identifier")}
            />

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Contraseña</Label>
                <Link
                  href={isPortal ? "/portal/auth/forgot" : "/auth/forgot"}
                  className="text-xs text-primary underline-offset-4 hover:underline"
                >
                  ¿Olvidaste?
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className={cn(
                    "h-12 pl-11 pr-11 text-base rounded-xl",
                    errors.password && "border-destructive"
                  )}
                  aria-invalid={!!errors.password}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Ocultar" : "Mostrar"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-xl text-base font-semibold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  Entrar <ArrowRight className="size-4 ml-1" />
                </>
              )}
            </Button>
          </form>
        </motion.div>

        {/* Demo access */}
        {process.env.NODE_ENV === "development" && (
          <motion.div
            className="mt-4 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              disabled={loading}
              onClick={() => void runLogin(DEMO_ACCOUNTS[0].identifier, DEMO_ACCOUNTS[0].password)}
            >
              Demo rápido: Cliente
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
