"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InfoTooltip } from "@/components/base/info-tooltip"
import { AlertCircle, Eye, EyeOff } from "lucide-react"

export interface InputGroupFieldProps
  extends React.ComponentProps<typeof Input> {
  label?: string
  helper?: React.ReactNode
  type?: React.HTMLInputTypeAttribute | undefined
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
    type,
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
  const isPassword = type === "password"
  const [showPassword, setShowPassword] = React.useState(false)

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
            hint && !hasError ? `${id}-describe` : undefined
          }
          className={cn(
            (leftIcon || leftAddon) && "pl-9 md:pl-9",
            isPassword && "pr-10 md:pr-10",
            rightAddon && !hasError && "pr-16 md:pr-16",
            hasError && !isPassword && "pr-9 md:pr-9",
            className
          )}
          type={isPassword && showPassword ? "text" : type}
          {...props}
        />
        {hasError && !isPassword && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-destructive">
            <AlertCircle className="size-4" />
          </span>
        )}
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword((s) => !s)}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
        {rightAddon && !hasError && !isPassword && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-muted-foreground">
            {rightAddon}
          </span>
        )}
      </div>
      {hint && !hasError && (
        <p
          id={`${id}-describe`}
          className="text-xs leading-relaxed text-muted-foreground"
        >
          {hint}
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
