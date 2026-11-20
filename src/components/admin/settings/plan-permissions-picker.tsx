"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { PERMISSION_MODULE_LABELS, permissionsByModule, type PermissionKey } from "@/lib/auth/permission-keys"
import { PLAN_PERMISSION_KEYS } from "@/lib/billing/plan-permissions"
import { cn } from "@/lib/utils"

// Selector de permisos incluidos en un plan, por módulo. Lo comparten el editor
// de planes y el plan Personalizado del control de suscripciones.

export const PLAN_MODULES = Object.entries(permissionsByModule())
  .map(([module, perms]) => [module, perms.filter((p) => PLAN_PERMISSION_KEYS.includes(p.key))] as const)
  .filter(([, perms]) => perms.length > 0)

export function PlanPermissionsPicker({ value, onChange }: { value: Set<string>; onChange: (next: Set<string>) => void }) {
  const toggle = (keys: PermissionKey[], on: boolean) => {
    const next = new Set(value)
    for (const k of keys) {
      if (on) next.add(k)
      else next.delete(k)
    }
    onChange(next)
  }
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {PLAN_MODULES.map(([module, perms]) => {
        const on = perms.filter((p) => value.has(p.key)).length
        return (
          <div key={module} className={cn("rounded-xl border p-3", on === 0 && "bg-muted/40")}>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox checked={on === perms.length ? true : on === 0 ? false : "indeterminate"} onCheckedChange={(v) => toggle(perms.map((p) => p.key), v === true)} />
              <span className="text-sm font-medium">{PERMISSION_MODULE_LABELS[module] ?? module}</span>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {on}/{perms.length}
              </span>
            </label>
            <div className="mt-2 space-y-1 pl-6">
              {perms.map((p) => (
                <label key={p.key} className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={value.has(p.key)} onCheckedChange={(v) => toggle([p.key], v === true)} />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
