import type { MetadataRoute } from "next";

// FASE 17.6 — PWA manifest (instalable).

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Multi-POS",
    short_name: "Multi-POS",
    description:
      "Sistema Multi-POS: punto de venta multi-sucursal, panel administrativo y portal de clientes.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#2563eb",
    icons: [
      { src: "/icon", sizes: "192x192", type: "image/png" },
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
