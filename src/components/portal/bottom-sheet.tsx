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
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPortal>
        <DrawerOverlay className="bg-black/40 supports-backdrop-filter:backdrop-blur-sm" />
        <DrawerContent
          className={cn(
            "max-h-[85vh] rounded-t-2xl border-t border-border/50 bg-background shadow-2xl",
            className
          )}
        >
          {/* Drag handle */}
          <div className="mx-auto mt-3 mb-1 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />

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
              "flex-1 overflow-y-auto px-4 pb-2",
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
