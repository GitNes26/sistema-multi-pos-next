"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { CheckCircle2, KeyRound, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InputGroupField } from "@/components/base/input-group-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const schema = yup.object({
  oldPassword: yup.string().required("Contraseña actual requerida"),
  newPassword: yup.string().required("Contraseña requerida").min(6, "Mínimo 6 caracteres"),
  confirm: yup
    .string()
    .oneOf([yup.ref("newPassword")], "Las contraseñas no coinciden")
    .required("Confirma tu contraseña"),
});

type Values = yup.InferType<typeof schema>;

export function ChangePasswordForm() {
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: yupResolver(schema) });

  async function onSubmit(values: Values) {
    setStatus({ kind: "loading" });
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPassword: values.oldPassword, newPassword: values.newPassword }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setStatus({ kind: "error", message: data?.error ?? "No se pudo cambiar la contraseña" });
      return;
    }
    reset();
    setStatus({ kind: "ok" });
  }

  return (
    <Card className="max-w-sm w-full">
      <CardHeader>
        <CardTitle className="text-center text-lg">Cambiar contraseña</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.kind === "ok" && (
          <Alert>
            <CheckCircle2 className="size-4" />
            <AlertDescription>Contraseña actualizada correctamente.</AlertDescription>
          </Alert>
        )}
        {status.kind === "error" && (
          <Alert variant="destructive">
            <AlertDescription>{status.message}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <InputGroupField
            id="oldPassword"
            label="Contraseña actual"
            type="password"
            leftIcon={<Lock className="size-4" />}
            autoComplete="current-password"
            error={errors.oldPassword?.message}
            {...register("oldPassword")}
          />

          <InputGroupField
            id="newPassword"
            label="Nueva contraseña"
            type="password"
            leftIcon={<KeyRound className="size-4" />}
            autoComplete="new-password"
            error={errors.newPassword?.message}
            {...register("newPassword")}
          />

          <InputGroupField
            id="confirm"
            label="Confirmar contraseña"
            type="password"
            leftIcon={<KeyRound className="size-4" />}
            autoComplete="new-password"
            error={errors.confirm?.message}
            {...register("confirm")}
          />

          <Button type="submit" className="w-full" disabled={status.kind === "loading"}>
            {status.kind === "loading" ? <Loader2 className="animate-spin" /> : <Lock />}
            Actualizar contraseña
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/auth/login" className="underline underline-offset-4">
            Volver al inicio de sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}