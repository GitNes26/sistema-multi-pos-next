import type { Metadata } from "next"
import { ShareLocation } from "@/components/driver/share-location"

export const metadata: Metadata = { title: "Compartir ubicación del traslado" }

// Enlace público para un chofer sin cuenta: comparte su ubicación mientras lleva el traslado.
export default async function TransferSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <ShareLocation token={token} />
}
