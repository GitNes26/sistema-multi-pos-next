"use client"

import { useCallback, useEffect, useState } from "react"
import useEmblaCarousel from "embla-carousel-react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ShoppingBag,
  Star,
  ClipboardList,
  Truck,
  ChevronRight,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SPRING_SNAPPY } from "@/lib/animation-tokens"
import { haptic } from "@/lib/haptics"

const ONBOARDING_KEY = "multi-pos-onboarding-done"

const SLIDES = [
  {
    icon: ShoppingBag,
    title: "Explora la tienda",
    description:
      "Encuentra todos los productos que te gustan, organizados por categorías. Favoritos, listas de compra y todo en un solo lugar.",
    color: "from-emerald-500 to-teal-600",
    bg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
  },
  {
    icon: Star,
    title: "Acumula puntos",
    description:
      "Cada compra te acerca a recompensas. Canjea tus puntos por descuentos, productos gratis o beneficios exclusivos.",
    color: "from-amber-500 to-orange-600",
    bg: "bg-amber-500/10",
    iconColor: "text-amber-500",
  },
  {
    icon: ClipboardList,
    title: "Seguimiento en tiempo real",
    description:
      "Consulta el estado de tus pedidos al instante. Desde la preparación hasta la entrega, todo visible para ti.",
    color: "from-blue-500 to-indigo-600",
    bg: "bg-blue-500/10",
    iconColor: "text-blue-500",
  },
  {
    icon: Truck,
    title: "Recibe en casa",
    description:
      "Elige entre recoger en tienda o recibir en tu dirección. Paga con tu método favorito y ¡listo!",
    color: "from-violet-500 to-purple-600",
    bg: "bg-violet-500/10",
    iconColor: "text-violet-500",
  },
]

export function OnboardingSheet() {
  const [open, setOpen] = useState(false)
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [canScrollNext, setCanScrollNext] = useState(true)

  // Show only once per user
  useEffect(() => {
    try {
      const done = localStorage.getItem(ONBOARDING_KEY)
      if (!done) setOpen(true)
    } catch {
      // SSR or localStorage unavailable
    }
  }, [])

  const scrollNext = useCallback(() => {
    if (!emblaApi) return
    haptic.light()
    emblaApi.scrollNext()
  }, [emblaApi])

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
    setCanScrollNext(emblaApi.canScrollNext())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on("select", onSelect)
    return () => {
      emblaApi.off("select", onSelect)
    }
  }, [emblaApi, onSelect])

  const handleDone = () => {
    haptic.medium()
    try {
      localStorage.setItem(ONBOARDING_KEY, "1")
    } catch {}
    setOpen(false)
  }

  const handleSkip = () => {
    haptic.light()
    handleDone()
  }

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={SPRING_SNAPPY}
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-background shadow-2xl sm:rounded-3xl"
          >
            {/* Skip button */}
            <button
              type="button"
              onClick={handleSkip}
              className="absolute right-4 top-4 z-10 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted/80"
            >
              Saltar
            </button>

            {/* Carousel */}
            <div ref={emblaRef} className="overflow-hidden">
              <div className="flex">
                {SLIDES.map((slide, i) => {
                  const Icon = slide.icon
                  const isActive = i === selectedIndex
                  return (
                    <div
                      key={slide.title}
                      className="min-w-0 shrink-0 grow-0 basis-full px-6 pt-12 pb-6"
                    >
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={
                          isActive
                            ? { scale: 1, opacity: 1 }
                            : { scale: 0.9, opacity: 0.5 }
                        }
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="flex flex-col items-center text-center"
                      >
                        {/* Icon */}
                        <div
                          className={cn(
                            "mb-6 flex size-20 items-center justify-center rounded-2xl",
                            slide.bg
                          )}
                        >
                          <Icon className={cn("size-10", slide.iconColor)} />
                        </div>

                        {/* Title */}
                        <h2 className="mb-2 text-xl font-bold">{slide.title}</h2>

                        {/* Description */}
                        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                          {slide.description}
                        </p>
                      </motion.div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Dot indicators */}
            <div className="flex items-center justify-center gap-2 pb-4">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    haptic.light()
                    emblaApi?.scrollTo(i)
                  }}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    i === selectedIndex
                      ? "w-6 bg-primary"
                      : "w-2 bg-muted-foreground/30"
                  )}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 px-6 pb-8">
              {canScrollNext ? (
                <Button
                  onClick={scrollNext}
                  className="h-12 flex-1 rounded-2xl text-sm font-semibold"
                >
                  Siguiente
                  <ChevronRight className="size-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleDone}
                  className="h-12 flex-1 rounded-2xl text-sm font-semibold"
                >
                  <Sparkles className="size-4 mr-1" />
                  ¡Empezar!
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
