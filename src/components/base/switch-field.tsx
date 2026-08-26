"use client"

import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

interface SwitchFieldProps {
  id?: string
  label: string
  description?: string
  checked?: boolean | null
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function SwitchField({
  id,
  label,
  description,
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
      <label htmlFor={switchId} className="cursor-pointer">
        <span className="block text-sm font-medium">{label}</span>
        {description && (
          <span className="block text-xs text-muted-foreground">{description}</span>
        )}
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
