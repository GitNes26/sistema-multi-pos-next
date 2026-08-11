"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2, Plus, RefreshCw, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command as CommandPrimitive } from "cmdk"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { InfoTooltip } from "@/components/base/info-tooltip"

export interface ComboboxOption {
  value: string
  label: string
  meta?: string
  disabled?: boolean
}

export interface FormComboboxProps {
  options: ComboboxOption[]
  value?: string | null
  onChange?: (value: string) => void
  onClear?: () => void
  onSync?: () => Promise<void> | void
  onCreate?: (name: string) => Promise<ComboboxOption | string | void>
  label?: string
  helper?: React.ReactNode
  required?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  loading?: boolean
  clearable?: boolean
  searchable?: boolean
  error?: string
  className?: string
  contentClassName?: string
}

export function FormCombobox({
  options,
  value,
  onChange,
  onClear,
  onSync,
  onCreate,
  label,
  helper,
  required,
  placeholder = "Selecciona…",
  searchPlaceholder = "Buscar…",
  emptyText = "Sin resultados",
  disabled,
  loading,
  clearable = true,
  searchable = true,
  error,
  className,
  contentClassName,
}: FormComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [creating, setCreating] = React.useState(false)
  const [newValue, setNewValue] = React.useState("")
  const [creatingLoading, setCreatingLoading] = React.useState(false)
  const [syncing, setSyncing] = React.useState(false)

  const selected = options.find((o) => o.value === value)

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) =>
      `${o.label} ${o.meta ?? ""}`.toLowerCase().includes(q)
    )
  }, [options, search])

  const handleCreate = async () => {
    const name = newValue.trim()
    if (!name || creatingLoading) return
    setCreatingLoading(true)
    try {
      const result = await onCreate?.(name)
      let created = result as ComboboxOption | string | void
      if (typeof created === "string") created = { value: created, label: name }
      if (created && "value" in created) {
        onChange?.(created.value)
        setOpen(false)
      }
      setNewValue("")
      setCreating(false)
    } finally {
      setCreatingLoading(false)
    }
  }

  const handleSync = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      await onSync?.()
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center gap-1.5">
          <Label className="leading-none">
            {label}
            {required && <span className="text-destructive"> *</span>}
          </Label>
          {helper && <InfoTooltip text={helper} />}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            data-slot="form-combobox-trigger"
            className={cn(
              "h-8 w-full justify-between px-3 font-normal",
              error && "border-destructive ring-3 ring-destructive/20",
              !selected && "text-muted-foreground"
            )}
          >
            <span className="truncate">
              {selected ? selected.label : placeholder}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {loading && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
              {clearable && selected && !disabled && (
                <button
                  type="button"
                  aria-label="Limpiar selección"
                  tabIndex={-1}
                  className={cn(
                    "rounded-sm p-0.5 text-muted-foreground transition-colors",
                    "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    onClear?.()
                    setSearch("")
                  }}
                >
                  <X className="size-3.5" />
                </button>
              )}
              <ChevronsUpDown className="size-4 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>

        {open && (
          <PopoverContent
            align="start"
            className={cn("w-full min-w-[--radix-popover-trigger-width] p-0", contentClassName)}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <CommandPrimitive
              shouldFilter={false}
              value={selected?.value ?? ""}
            >
              {searchable && (
                <div className="border-b p-2">
                  <CommandPrimitive.Input
                    value={search}
                    onValueChange={setSearch}
                    placeholder={searchPlaceholder}
                    autoFocus
                    className="flex h-8 w-full items-center rounded-md bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              )}

              <ScrollArea className="max-h-64">
                <CommandPrimitive.List className="p-1">
                  {filtered.length === 0 && !creating && (
                    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                      <p className="text-sm text-muted-foreground">{emptyText}</p>
                      {onCreate && (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => setCreating(true)}
                        >
                          <Plus /> Agregar “{search.trim() || "nuevo"}”
                        </Button>
                      )}
                    </div>
                  )}

                  {creating && (
                    <div className="flex flex-col gap-2 border-b p-2">
                      <p className="text-xs font-medium text-foreground">
                        Crear nueva opción
                      </p>
                      <Input
                        autoFocus
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            void handleCreate()
                          }
                          if (e.key === "Escape") {
                            setCreating(false)
                            setNewValue("")
                          }
                        }}
                        placeholder={placeholder}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setCreating(false)
                            setNewValue("")
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          onClick={() => void handleCreate()}
                          disabled={creatingLoading || !newValue.trim()}
                        >
                          {creatingLoading ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Plus />
                          )}
                          Crear
                        </Button>
                      </div>
                    </div>
                  )}

                  <CommandPrimitive.Group>
                    {filtered.map((option) => (
                      <CommandPrimitive.Item
                        key={option.value}
                        value={option.value}
                        disabled={option.disabled}
                        onSelect={() => {
                          onChange?.(option.value)
                          setOpen(false)
                          setSearch("")
                        }}
                        className={cn(
                          "flex cursor-default select-none items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[selected='true']:bg-accent data-[selected='true']:text-accent-foreground data-[disabled='true']:pointer-events-none data-[disabled='true']:opacity-50 [&_svg]:pointer-events-none"
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate">{option.label}</span>
                          {option.meta && (
                            <span className="truncate text-xs text-muted-foreground">
                              {option.meta}
                            </span>
                          )}
                        </span>
                        {option.value === value && (
                          <Check className="size-4 shrink-0 text-primary" />
                        )}
                      </CommandPrimitive.Item>
                    ))}
                  </CommandPrimitive.Group>

                  {filtered.length === 0 && creating && (
                    <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                      Escribe un nombre y presiona “Crear”.
                    </p>
                  )}
                </CommandPrimitive.List>
              </ScrollArea>

              {(onSync || onCreate) && (
                <div className="flex items-center justify-between gap-2 border-t p-2">
                  {onSync ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => void handleSync()}
                      disabled={syncing}
                    >
                      {syncing ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3.5" />
                      )}
                      Sincronizar
                    </Button>
                  ) : (
                    <span />
                  )}
                  {onCreate && !creating && (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => setCreating(true)}
                    >
                      <Plus />
                      Agregar
                    </Button>
                  )}
                </div>
              )}
            </CommandPrimitive>
          </PopoverContent>
        )}
      </Popover>

      {error && (
        <p className="text-xs leading-relaxed text-destructive">{error}</p>
      )}
    </div>
  )
}