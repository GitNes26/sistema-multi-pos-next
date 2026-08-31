"use client"

import * as React from "react"

interface LongPressOptions {
  threshold?: number
  onLongPress: () => void
  onPress?: () => void
}

export function useLongPress({
  threshold = 500,
  onLongPress,
  onPress,
}: LongPressOptions) {
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPress = React.useRef(false)

  const start = React.useCallback(
    () => {
      isLongPress.current = false
      timerRef.current = setTimeout(() => {
        isLongPress.current = true
        onLongPress()
      }, threshold)
    },
    [onLongPress, threshold]
  )

  const stop = React.useCallback(
    () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (!isLongPress.current && onPress) {
        onPress()
      }
    },
    [onPress]
  )

  const cancel = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  React.useEffect(() => {
    return () => cancel()
  }, [cancel])

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: stop,
  }
}

interface LongPressProps extends LongPressOptions {
  children: React.ReactNode
  className?: string
}

export function LongPress({
  children,
  className,
  ...options
}: LongPressProps) {
  const handlers = useLongPress(options)

  return (
    <div className={className} {...handlers}>
      {children}
    </div>
  )
}
