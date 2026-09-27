"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/layout/logo"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { cn } from "@/lib/utils"

export function Brand() {
  return (
    <span className="flex items-center gap-2.5 font-semibold">
      <Logo size={20} className="rounded-lg" />
      <span className="text-lg tracking-tight whitespace-nowrap">Multi-POS</span>
    </span>
  )
}

// Encabezado de la portada: se compacta y gana sombra al hacer scroll, y
// resalta la sección visible con un indicador que se desliza entre enlaces.
export function SiteHeader({ sections }: { sections: { id: string; label: string }[] }) {
  const [scrolled, setScrolled] = useState(false)
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => !!el)
    if (els.length === 0) return
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5] }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [sections])

  return (
    <header
      className={cn(
        "safe-area-top sticky top-0 z-40 border-b transition-[background-color,box-shadow,border-color] duration-300",
        scrolled
          ? "border-border bg-background/85 shadow-e1 supports-backdrop-filter:backdrop-blur-lg"
          : "border-transparent bg-background/0"
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 transition-[padding] duration-300 sm:px-6",
          scrolled ? "py-2" : "py-3.5"
        )}
      >
        <Link href="/" aria-label="Multi-POS, inicio">
          <Brand />
        </Link>

        <nav aria-label="Secciones" className="hidden items-center gap-1 lg:flex">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={cn(
                "relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active === s.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active === s.id && (
                <motion.span
                  layoutId="landing-nav-active"
                  className="absolute inset-0 -z-10 rounded-lg bg-muted"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              {s.label}
            </a>
          ))}
        </nav>

        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Accesos">
          <ThemeToggle className="size-9" />
          <Button asChild variant="ghost" size="sm">
            <Link href="/auth/login">
              <span className="sm:hidden">Panel</span>
              <span className="hidden sm:inline">Acceso panel</span>
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/portal/auth/login">
              <span className="sm:hidden">Portal</span>
              <span className="hidden sm:inline">Portal de clientes</span>
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  )
}
