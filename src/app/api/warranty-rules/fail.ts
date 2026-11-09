import { NextResponse } from "next/server"
import { WarrantyError } from "@/lib/warranty/server"

export function warrantyFail(err: unknown) {
  if (err instanceof WarrantyError) return NextResponse.json({ ok: false, error: err.message, field: err.field }, { status: err.status })
  console.error("[warranty]", err)
  return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 })
}
