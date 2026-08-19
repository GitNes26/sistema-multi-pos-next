"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useThemeStore } from "@/stores/theme-store"
import { resolveTheme } from "@/lib/appearance-apply"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Toggle de tema claro/oscuro para el header.

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const [resolved, setResolved] = React.useState<"light" | "dark" | "pos">(
    "light"
  )

  React.useEffect(() => {
    setResolved(resolveTheme(theme))
  }, [theme])

  const isDark = resolved === "dark" || resolved === "pos"

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"
            }
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:rotate-3600 active:scale-50 transition-transform"
          >
            {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isDark
            ? "Tema oscuro · clic para claro"
            : "Tema claro · clic para oscuro"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
