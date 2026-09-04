"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Drawer,
  DrawerPortal,
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
  const [snap, setSnap] = React.useState<number | string | null>(0.95)

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
    >
      <DrawerPortal>
        <DrawerContent
          overlayClassName="bg-black/60 backdrop-blur-md supports-backdrop-filter:backdrop-blur-md"
          className={cn(
            "mx-auto flex flex-col rounded-t-3xl border-t border-border/30 bg-background shadow-[0_-8px_30px_rgba(0,0,0,0.18)]",
            className
          )}
          style={{ height: '95vh', maxHeight: '95vh', marginTop: 0 }}
        >
          {/* Drag handle */}
          <div className="mx-auto mt-2.5 mb-1 flex h-1.5 w-12 shrink-0 cursor-grab touch-none items-center justify-center rounded-full bg-muted-foreground/25 active:cursor-grabbing active:bg-muted-foreground/40" />

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
              "flex-1 overflow-y-auto px-4 pb-4 min-h-0",
              bodyClassName
            )}
          >
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <DrawerFooter className="shrink-0 flex-row justify-end gap-2 border-t px-4 py-3">
              {footer}
            </DrawerFooter>
          )}
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  )
}
