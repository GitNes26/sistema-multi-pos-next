"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Eye, EyeOff, Loader2, Lock, LogIn, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type LoginMode = "pos" | "portal";

const validationSchema = yup.object({
  identifier: yup
    .string()
    .required("Correo o código requerido")
    .min(3, "Demasiado corto"),
  password: yup.string().required("Contraseña requerida").min(6, "Mínimo 6 caracteres"),
});

type LoginValues = yup.InferType<typeof validationSchema>;

const DEMO_ACCOUNTS: { mode: LoginMode; label: string; identifier: string; password: string }[] = [
  { mode: "pos", label: "Owner", identifier: "demo@multi-pos.com", password: "demo1234" },
  { mode: "pos", label: "Gerente", identifier: "manager@demo.multi-pos.com", password: "demo1234" },
  { mode: "pos", label: "Cajero", identifier: "cajero1@demo.multi-pos.com", password: "demo1234" },
  { mode: "pos", label: "Repartidor", identifier: "repartidor@demo.multi-pos.com", password: "demo1234" },
  { mode: "portal", label: "Cliente demo", identifier: "cli-001@portal.local", password: "demo1234" },
];

export function LoginForm({
  mode,
  callbackUrl,
  error: nextAuthError,
}: {
  mode: LoginMode;
  callbackUrl?: string | null;
  error?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: yupResolver(validationSchema),
    defaultValues: { identifier: "", password: "" },
  });

  async function runLogin(identifier: string, password: string) {
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      identifier,
      password,
      redirect: false,
      callbackUrl: callbackUrl ?? undefined,
    });
    setLoading(false);

    if (res?.error) {
      setError("Credenciales incorrectas o usuario inactivo.");
      return;
    }
    const target = res?.url;
    if (target) router.push(target);
    else router.refresh();
  }

  function onSubmit(values: LoginValues) {
    void runLogin(values.identifier, values.password);
  }

  return (
    <div className="w-full max-w-sm">
      <Card className="border-border/60 shadow-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LogIn className="size-6" />
          </div>
          <CardTitle className="text-xl">
            {mode === "portal" ? "Portal de clientes" : "Sistema Multi-POS"}
          </CardTitle>
          <CardDescription>
            {mode === "portal"
              ? "Ingresa con tu correo o nº de cliente para hacer pedidos."
              : "Ingresa con tu correo o código de nómina."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {(error ?? nextAuthError) && (
            <Alert variant="destructive">
              <AlertDescription>
                {error ?? "No se pudo iniciar sesión. Revisa tus credenciales."}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="identifier">Correo o código</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="identifier"
                  autoComplete="username"
                  placeholder={mode === "portal" ? "correo o nº de cliente" : "correo o nº de nómina"}
                  className="pl-9"
                  aria-invalid={!!errors.identifier}
                  {...register("identifier")}
                />
              </div>
              {errors.identifier && (
                <p className="text-xs text-destructive">{errors.identifier.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                <Link
                  href={mode === "portal" ? "/portal/auth/forgot" : "/auth/forgot"}
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="pl-9 pr-9"
                  aria-invalid={!!errors.password}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
              Iniciar sesión
            </Button>
          </form>

          {process.env.NODE_ENV === "development" && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-center text-xs text-muted-foreground">
                  Acceso rápido demo (modo desarrollo) — demo1234
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {DEMO_ACCOUNTS.filter((a) => a.mode === mode).map((acc) => (
                    <Button
                      key={acc.identifier}
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={loading}
                      onClick={() => void runLogin(acc.identifier, acc.password)}
                    >
                      {acc.label}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}