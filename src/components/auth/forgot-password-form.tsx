"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Loader2, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const schema = yup.object({
  email: yup.string().email("Correo inválido").required("Correo requerido"),
});

type Values = yup.InferType<typeof schema>;

export function ForgotPasswordForm() {
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok"; devResetUrl: string | null }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: yupResolver(schema) });

  async function onSubmit(values: Values) {
    setStatus({ kind: "loading" });
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: values.email }),
    });
    const data = (await res.json().catch(() => null)) as {
      devResetUrl?: string | null;
      error?: string;
    } | null;
    if (!res.ok) {
      setStatus({ kind: "error", message: data?.error ?? "No se pudo procesar la solicitud" });
      return;
    }
    setStatus({ kind: "ok", devResetUrl: data?.devResetUrl ?? null });
  }

  return (
    <Card className="max-w-sm w-full">
      <CardHeader>
        <CardTitle className="text-center text-lg">Recuperar contraseña</CardTitle>
        <CardDescription>
          Ingresa el correo de tu cuenta y te enviaremos (o mostraremos en desarrollo) el enlace para
          restablecerla.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.kind === "ok" && (
          <Alert>
            <AlertDescription className="space-y-2">
              <p>
                Si el correo existe, se generó un enlace válido por 1 hora. En este entorno de
                desarrollo:
              </p>
              {status.devResetUrl ? (
                <a
                  href={status.devResetUrl}
                  className="font-semibold text-primary underline underline-offset-4"
                >
                  Abrir enlace de restablecimiento
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No se mostrará el enlace porque el correo no existe.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {status.kind === "error" && (
          <Alert variant="destructive">
            <AlertDescription>{status.message}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                className="pl-9"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
            </div>
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={status.kind === "loading"}>
            {status.kind === "loading" ? <Loader2 className="animate-spin" /> : <Send />}
            Enviar enlace
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}