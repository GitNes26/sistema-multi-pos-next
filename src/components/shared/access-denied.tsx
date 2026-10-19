import Link from "next/link"
import { LockKeyhole } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PERMISSIONS, type PermissionKey } from "@/lib/auth/permission-keys"

// Pantalla que reemplaza al redireccionamiento silencioso: explica por qué no se
// puede abrir la sección y qué hacer. Componente de servidor (sin estado).

export function AccessDenied({ permission, what }: { permission?: PermissionKey; what?: string }) {
  const label = what ?? PERMISSIONS.find((p) => p.key === permission)?.label
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <LockKeyhole className="size-7" />
      </span>
      <div className="space-y-2">
        <h1 className="font-heading text-xl font-semibold">Aquí no tienes acceso</h1>
        <p className="text-sm text-muted-foreground">
          {label ? <>Tu usuario no tiene el permiso de «{label}». </> : <>Tu usuario no tiene permiso para abrir esta pantalla. </>}
          Puede ser porque tu rol no lo incluye o porque tu plan no lo trae.
        </p>
        <p className="text-sm text-muted-foreground">
          Pídele al dueño o a un administrador que lo active en <strong>Ajustes → Usuarios y permisos</strong>, o revisa <strong>Mi plan</strong>.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/admin">Volver al panel</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/settings/my-plan">Ver mi plan</Link>
        </Button>
      </div>
    </div>
  )
}
