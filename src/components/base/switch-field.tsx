"use client"

import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

interface SwitchFieldProps {
  id?: string
  label: string
  description?: string
  icon?: React.ReactNode
  checked?: boolean | null
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function SwitchField({
  id,
  label,
  description,
  icon,
  checked,
  onCheckedChange,
  disabled,
  className,
}: SwitchFieldProps) {
  const switchId = id ?? `switch-${label.replace(/\s+/g, "-").toLowerCase()}`

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border p-2.5",
        disabled && "opacity-50",
        className
      )}
    >
      <label htmlFor={switchId} className="flex items-center gap-2 cursor-pointer">
        {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
        <span className="text-sm font-medium">{label}</span>
      </label>
      <Switch
        id={switchId}
        checked={checked ?? false}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  )
}
