import type { Metadata } from "next";
import { FavoritesClient } from "@/components/portal/favorites-client";

export const metadata: Metadata = { title: "Favoritos — Portal" };

export default function PortalFavoritesPage() {
  return <FavoritesClient />;
}
