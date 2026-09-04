import type { Metadata } from "next"
import { ProductDetailClient } from "@/components/portal/product-detail-client"

export const metadata: Metadata = { title: "Producto — Portal" }

export default async function PortalProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ProductDetailClient productId={id} />
}
