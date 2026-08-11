"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const schema = yup.object({
  password: yup.string().required("Contraseña requerida").min(6, "Mínimo 6 caracteres"),
  confirm: yup
    .string()
    .oneOf([yup.ref("password")], "Las contraseñas no coinciden")
    .required("Confirma tu contraseña"),
});

type Values = yup.InferType<typeof schema>;

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: yupResolver(schema) });

  if (!token) {
    return (
      <Card className="max-w-sm w-full">
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertDescription>
              Enlace inválido.{" "}
              <Link href="/auth/forgot" className="underline underline-offset-4">
                Solicita uno nuevo
              </Link>
              .
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  async function onSubmit(values: Values) {
    setStatus({ kind: "loading" });
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: values.password }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setStatus({ kind: "error", message: data?.error ?? "No se pudo restablecer" });
      return;
    }
    setStatus({ kind: "ok" });
  }

  return (
    <Card className="max-w-sm w-full">
      <CardHeader>
        <CardTitle className="text-center text-lg">Nueva contraseña</CardTitle>
        <CardDescription>Elige una nueva contraseña para tu cuenta.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.kind === "ok" && (
          <Alert>
            <CheckCircle2 className="size-4" />
            <AlertDescription className="space-y-1">
              <p>¡Contraseña actualizada!</p>
              <Link href="/auth/login" className="font-semibold underline underline-offset-4">
                Iniciar sesión
              </Link>
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
            <Label htmlFor="password">Nueva contraseña</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                className="pl-9"
                aria-invalid={!!errors.password}
                {...register("password")}
              />
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar contraseña</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirm}
              {...register("confirm")}
            />
            {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={status.kind === "loading"}>
            {status.kind === "loading" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            Guardar contraseña
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}