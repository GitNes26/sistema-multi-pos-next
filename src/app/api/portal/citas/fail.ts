import { NextResponse } from "next/server"
import { AgendaError } from "@/lib/agenda/server"
import { PolicyError } from "@/lib/agenda/policy"
import { portalErrorResponse } from "../guard"

export function citasFail(err: unknown) {
  if (err instanceof AgendaError || err instanceof PolicyError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status })
  return portalErrorResponse(err)
}
