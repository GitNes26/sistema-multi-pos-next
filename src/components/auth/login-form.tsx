"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { motion } from "framer-motion"
import { Eye, EyeOff, Loader2, Lock, User, ArrowRight, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { InputGroupField } from "@/components/base/input-group-field"
import { Logo } from "@/components/layout/logo"
import { BusinessModeDot } from "@/components/shared/business-mode-badge"
import { cn } from "@/lib/utils"

// Selector de organización del login (multi-org): tras escribir el
// identificador, el usuario con varias membresías puede elegir a cuál entrar
// antes de autenticarse; la elección viaja en signIn() y define rol, permisos
// y organización activa. La lista viene de /api/auth/org-hint, con respuestas
// neutras cuando el identificador no existe o no tiene organizaciones.
interface OrgHint {
  id: string;
  name: string;
  businessMode: string;
  currency: string;
  isLast: boolean;
}
interface OrgHintResponse {
  lastOrg: { id: string; name: string } | null;
  organizations: {
    id: string;
    name: string;
    businessMode: string;
    currency: string;
  }[];
  accessibleCount: number | null;
}

const validationSchema = yup.object({
  identifier: yup
    .string()
    .required("Correo o código requerido")
    .min(3, "Demasiado corto"),
  password: yup
    .string()
    .required("Contraseña requerida")
    .min(6, "Mínimo 6 caracteres"),
})

type LoginValues = yup.InferType<typeof validationSchema>

const DEMO_ACCOUNTS = [
  {
    label: "Cliente demo",
    identifier: "cli-001@portal.local",
    password: "demo1234",
  },
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
  const [orgHint, setOrgHint] = useState<OrgHint[] | null>(null)
  const [pickedOrgId, setPickedOrgId] = useState<string>("")
  const [hintDelay] = useState(() => ({ timer: null as ReturnType<typeof setTimeout> | null }))

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: yupResolver(validationSchema),
    defaultValues: { identifier: "", password: "" },
  })

  /** Busca la lista de orgs del identificador con debounce; limpia al vaciar. */
  function onIdentifierChange(value: string) {
    if (hintDelay.timer) clearTimeout(hintDelay.timer)
    const v = value.trim()
    if (v.length < 5) {
      setOrgHint(null)
      setPickedOrgId("")
      return
    }
    hintDelay.timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/auth/org-hint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: v }),
        })
        if (!res.ok) return
        const data = (await res.json()) as OrgHintResponse
        if (!data.organizations || data.organizations.length < 2) {
          // Single-org (o sin orgs): sin selector — el flujo normal decide.
          setOrgHint(null)
          setPickedOrgId("")
          return
        }
        const mapped: OrgHint[] = data.organizations.map((o) => ({
          ...o,
          isLast: data.lastOrg?.id === o.id,
        }))
        setOrgHint(mapped)
        // Preseleccionar la org recordada (sin override del usuario).
        setPickedOrgId(data.lastOrg?.id ?? "")
      } catch {
        // Pista best-effort: sin conexión, el login funciona igual.
      }
    }, 600)
  }

  async function runLogin(identifier: string, password: string) {
    setLoading(true)
    setError(null)
    const res = await signIn("credentials", {
      identifier,
      password,
      organizationId: pickedOrgId || undefined,
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

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            {!isPortal && orgHint && orgHint.length >= 2 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  <Building2 className="mr-1 inline size-3.5" />
                  Entrar a
                </Label>
                <Select
                  value={pickedOrgId || undefined}
                  onValueChange={setPickedOrgId}
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Organización (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgHint.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        <span className="flex items-center gap-2">
                          <BusinessModeDot mode={o.businessMode as never} />
                          <span className="truncate font-medium">{o.name}</span>
                          <span className="text-xs text-muted-foreground">{o.currency}</span>
                          {o.isLast && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                              · última vez
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <InputGroupField
              id="identifier"
              label="Correo o código"
              leftIcon={<User className="size-4" />}
              autoComplete="username"
              placeholder={
                isPortal ? "correo o nº de cliente" : "correo o nº de nómina"
              }
              className="h-12 text-base rounded-xl"
              error={errors.identifier?.message}
              {...register("identifier", {
                onChange: (e) => onIdentifierChange(e.target.value),
              })}
            />

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  Contraseña
                </Label>
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
                    "h-12 pl-11 md:pl-11 pr-11 md:pr-11 text-base rounded-xl",
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
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
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
              onClick={() =>
                void runLogin(
                  DEMO_ACCOUNTS[0].identifier,
                  DEMO_ACCOUNTS[0].password
                )
              }
            >
              Demo rápido: Cliente
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
