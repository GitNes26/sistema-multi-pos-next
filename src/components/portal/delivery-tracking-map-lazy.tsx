"use client"

import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

// Dynamic import — Leaflet requires the browser DOM
const DeliveryTrackingMap = dynamic(
  () => import("./delivery-tracking-map").then((mod) => mod.DeliveryTrackingMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center bg-muted/30"
        style={{ height: 230 }}
      >
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
)

export { DeliveryTrackingMap }
export type { TrackingPoint } from "./delivery-tracking-map"
