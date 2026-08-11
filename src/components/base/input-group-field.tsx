"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InfoTooltip } from "@/components/base/info-tooltip"

export interface InputGroupFieldProps
  extends React.ComponentProps<typeof Input> {
  label?: string
  helper?: React.ReactNode
  hint?: string
  error?: string
  required?: boolean
  leftIcon?: React.ReactNode
  leftAddon?: React.ReactNode
  rightAddon?: React.ReactNode
  containerClassName?: string
}

export const InputGroupField = React.forwardRef<
  HTMLInputElement,
  InputGroupFieldProps
>(function InputGroupField(
  {
    label,
    helper,
    hint,
    error,
    required,
    leftIcon,
    leftAddon,
    rightAddon,
    className,
    containerClassName,
    id,
    ...props
  },
  ref
) {
  const [hasError] = useForwardedError(error)

  return (
    <div className={cn("space-y-2", containerClassName)}>
      {label && (
        <div className="flex items-center gap-1.5">
          <Label htmlFor={id} className="leading-none">
            {label}
            {required && <span className="text-destructive"> *</span>}
          </Label>
          {helper && <InfoTooltip text={helper} />}
        </div>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
            {leftIcon}
          </span>
        )}
        {leftAddon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-muted-foreground">
            {leftAddon}
          </span>
        )}
        <Input
          ref={ref}
          id={id}
          aria-invalid={hasError || undefined}
          aria-describedby={
            error || hint ? `${id}-describe` : undefined
          }
          className={cn(
            (leftIcon || leftAddon) && "pl-9",
            rightAddon && "pr-20",
            className
          )}
          {...props}
        />
        {rightAddon && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-muted-foreground">
            {rightAddon}
          </span>
        )}
      </div>
      {(error || hint) && (
        <p
          id={`${id}-describe`}
          className={cn(
            "text-xs leading-relaxed",
            error ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {error || hint}
        </p>
      )}
    </div>
  )
})

function useForwardedError(error?: string) {
  return React.useMemo(
    () => [Boolean(error)] as const,
    [error]
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"