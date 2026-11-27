"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MONTH_NAMES, parseMonthText } from "@/lib/month-input"

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const MIN_YEAR = 1000
const MAX_YEAR = 9999

/**
 * Encabezado del calendario: flechas, mes y año. El mes y el año se pueden
 * escribir («ago», «8», «2031») y no hay tope de navegación salvo el que pida
 * el llamador (`startMonth` / `endMonth`).
 */
export function CalendarHeader({
  month,
  onMonthChange,
  startMonth,
  endMonth,
}: {
  month: Date
  onMonthChange: (month: Date) => void
  startMonth?: Date
  endMonth?: Date
}) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const [monthText, setMonthText] = React.useState<string | null>(null)
  const [yearText, setYearText] = React.useState<string | null>(null)
  const [gridOpen, setGridOpen] = React.useState(false)

  const serial = (y: number, m: number) => y * 12 + m
  const min = startMonth ? serial(startMonth.getFullYear(), startMonth.getMonth()) : serial(MIN_YEAR, 0)
  const max = endMonth ? serial(endMonth.getFullYear(), endMonth.getMonth()) : serial(MAX_YEAR, 11)
  const go = (y: number, m: number) => {
    const next = Math.max(min, Math.min(max, serial(y, m)))
    const date = new Date(2000, 0, 1)
    date.setFullYear(Math.floor(next / 12), next % 12, 1)
    onMonthChange(date)
  }
  const closeMonth = () => {
    setMonthText(null)
    setGridOpen(false)
  }

  const inputClass =
    "h-8 cursor-text rounded-md border border-input bg-transparent text-center text-sm font-medium outline-none transition-colors hover:bg-muted/60 focus:border-ring focus:ring-3 focus:ring-ring/50"

  return (
    <div className="space-y-2 px-2 pt-2">
      <div className="flex items-center justify-between gap-1">
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Mes anterior" disabled={serial(year, monthIndex) <= min} onClick={() => go(year, monthIndex - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex items-center gap-1.5">
          <input
            aria-label="Mes (nombre o número)"
            autoComplete="off"
            className={cn(inputClass, "w-28")}
            value={monthText ?? capitalize(MONTH_NAMES[monthIndex])}
            onFocus={(e) => e.currentTarget.select()}
            onClick={(e) => {
              e.currentTarget.select()
              setGridOpen(true)
            }}
            onChange={(e) => {
              const text = e.target.value.slice(0, 10)
              setMonthText(text)
              setGridOpen(true)
              const parsed = parseMonthText(text)
              if (parsed !== null) go(year, parsed)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                closeMonth()
              }
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault()
                setMonthText(null)
                go(year, monthIndex + (e.key === "ArrowUp" ? 1 : -1))
              }
            }}
            onBlur={closeMonth}
          />
          <input
            aria-label="Año"
            inputMode="numeric"
            autoComplete="off"
            className={cn(inputClass, "w-16 tabular-nums")}
            value={yearText ?? String(year)}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const text = e.target.value.replace(/\D/g, "").slice(0, 4)
              setYearText(text)
              if (text.length === 4 && Number(text) >= MIN_YEAR) go(Number(text), monthIndex)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                setYearText(null)
              }
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault()
                setYearText(null)
                go(year + (e.key === "ArrowUp" ? 1 : -1), monthIndex)
              }
            }}
            onBlur={() => setYearText(null)}
          />
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Mes siguiente" disabled={serial(year, monthIndex) >= max} onClick={() => go(year, monthIndex + 1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
      {gridOpen && (
        <div className="grid grid-cols-3 gap-1" role="listbox" aria-label="Meses">
          {MONTH_NAMES.map((name, index) => (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={index === monthIndex}
              disabled={serial(year, index) < min || serial(year, index) > max}
              // Evita que el campo pierda el foco antes de registrar el clic.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                go(year, index)
                closeMonth()
              }}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1.5 text-sm transition-colors disabled:cursor-default disabled:opacity-40",
                index === monthIndex ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              {capitalize(name.slice(0, 3))}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
