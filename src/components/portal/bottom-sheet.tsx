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
  height?: string
  maxHeight?: string
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
  height = "95dvh",
  maxHeight = "95dvh",
}: BottomSheetProps) {
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
          style={{ height, maxHeight, marginTop: 0 }}
        >
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
