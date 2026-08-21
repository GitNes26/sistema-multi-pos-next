"use client"

import { useCallback } from "react"

/**
 * Focuses the first invalid field in a form when validation fails.
 * Usage: call `focusFirstInvalid(errors)` after validation where `errors`
 * is an object with field names as keys and error messages as values.
 */
export function useFocusInvalid() {
  const focusFirstInvalid = useCallback(
    (errors: Record<string, unknown>, formId?: string) => {
      const firstKey = Object.keys(errors)[0]
      if (!firstKey) return

      // Try to find the element by id (InputGroupField uses id for the input)
      let el = document.getElementById(firstKey)

      // Fallback: look for [aria-invalid="true"] inside the form
      if (!el) {
        const form = formId
          ? document.getElementById(formId)
          : document.querySelector("form")
        el = form?.querySelector('[aria-invalid="true"]') as HTMLElement | null
      }

      if (el) {
        el.focus()
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    },
    []
  )

  return { focusFirstInvalid }
}
