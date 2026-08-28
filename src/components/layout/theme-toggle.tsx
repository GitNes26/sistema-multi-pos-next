"use client"

import * as React from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { useThemeStore } from "@/stores/theme-store"
import { resolveTheme } from "@/lib/appearance-apply"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type ThemeCycle = "light" | "dark" | "system"

const CYCLE: ThemeCycle[] = ["light", "dark", "system"]

const CYCLE_ICONS: Record<ThemeCycle, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

const CYCLE_LABELS: Record<ThemeCycle, string> = {
  light: "Tema claro",
  dark: "Tema oscuro",
  system: "Tema del sistema",
}

const CYCLE_TOOLTIPS: Record<ThemeCycle, string> = {
  light: "Claro · clic para oscuro",
  dark: "Oscuro · clic para sistema",
  system: "Sistema · clic para claro",
}

// Toggle de tema claro/oscuro/sistema para el header.

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const [resolved, setResolved] = React.useState<"light" | "dark" | "pos">(
    "light"
  )

  React.useEffect(() => {
    setResolved(resolveTheme(theme))
  }, [theme])

  const current: ThemeCycle =
    theme === "system" ? "system" : resolved === "dark" || resolved === "pos" ? "dark" : "light"

  const next = (): ThemeCycle => {
    const idx = CYCLE.indexOf(current)
    return CYCLE[(idx + 1) % CYCLE.length]
  }

  const Icon = CYCLE_ICONS[current]

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={CYCLE_LABELS[current]}
            onClick={() => setTheme(next())}
            className="cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:rotate-3600 active:scale-50 transition-transform"
          >
            <Icon className="size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{CYCLE_TOOLTIPS[current]}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
