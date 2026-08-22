"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  showCloseButton?: boolean
}

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  className,
  bodyClassName,
  showCloseButton = true,
}: BottomSheetProps) {
  const [snap, setSnap] = React.useState<number | string | null>(null)

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[0.85, 1]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <DrawerPortal>
        <DrawerOverlay className="bg-black/50 supports-backdrop-filter:backdrop-blur-sm" />
        <DrawerContent
          className={cn(
            "mx-auto flex max-h-[92vh] flex-col rounded-t-2xl border-t border-border/30 bg-background shadow-[0_-8px_30px_rgba(0,0,0,0.12)]",
            snap === 1 && "rounded-none",
            className
          )}
        >
          {/* Drag handle */}
          <div className="mx-auto mt-3 mb-1 flex h-1 w-10 shrink-0 cursor-grab items-center justify-center rounded-full bg-muted-foreground/25 active:bg-muted-foreground/40" />

          {/* Header */}
          {(title || showCloseButton) && (
            <DrawerHeader className="flex flex-row items-center gap-3 px-4 pb-2 pt-2">
              <div className="min-w-0 flex-1">
                {title && (
                  <DrawerTitle className="text-left text-base font-semibold">
                    {title}
                  </DrawerTitle>
                )}
                {description && (
                  <DrawerDescription className="mt-0.5 text-left text-xs">
                    {description}
                  </DrawerDescription>
                )}
              </div>
              {showCloseButton && (
                <DrawerClose asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground"
                    aria-label="Cerrar"
                  >
                    <X className="size-4" />
                  </Button>
                </DrawerClose>
              )}
            </DrawerHeader>
          )}

          {/* Body */}
          <div
            className={cn(
              "flex-1 overflow-y-auto px-4 pb-4",
              bodyClassName
            )}
          >
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <DrawerFooter className="flex-row justify-end gap-2 border-t px-4 py-3">
              {footer}
            </DrawerFooter>
          )}
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  )
}
