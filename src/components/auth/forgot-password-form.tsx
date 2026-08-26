"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Loader2, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InputGroupField } from "@/components/base/input-group-field";
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
          <InputGroupField
            id="email"
            label="Correo electrónico"
            type="email"
            leftIcon={<Mail className="size-4" />}
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />

          <Button type="submit" className="w-full" disabled={status.kind === "loading"}>
            {status.kind === "loading" ? <Loader2 className="animate-spin" /> : <Send />}
            Enviar enlace
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}