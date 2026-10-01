import type { MetadataRoute } from "next";

// FASE 17.6 — PWA manifest (instalable).

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Multi-POS",
    short_name: "Multi-POS",
    description:
      "Sistema Multi-POS: punto de venta multi-sucursal, panel administrativo y portal de clientes.",
    id: "/",
    scope: "/",
    start_url: "/",
    display: "standalone",
    // Chrome: un enlace a la app abre su ventana ya instalada en lugar del navegador.
    ...({ launch_handler: { client_mode: ["navigate-existing", "auto"] } } as object),
    background_color: "#0f172a",
    theme_color: "#0f172a",
    icons: [
      { src: "/icon", sizes: "192x192", type: "image/png" },
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
