import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // pdfkit lee sus fuentes (.afm) con rutas relativas a __dirname; si Turbopack
  // lo empaqueta, ese __dirname apunta a una ruta virtual y falla (ENOENT).
  // Se mantiene externo para que use la ruta real de node_modules.
  serverExternalPackages: ["pdfkit", "exceljs", "sharp"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "ui-avatars.com" },
    ],
  },
  async rewrites() {
    // Los registros anteriores guardaron /uploads/...; en standalone los archivos
    // agregados después del build se sirven de forma fiable por la ruta dinámica.
    return [{ source: "/uploads/:organizationId/:fileName", destination: "/api/media/:organizationId/:fileName" }]
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(self), microphone=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
      {
        source: "/api/sse/:path*",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-transform" },
          { key: "X-Accel-Buffering", value: "no" },
        ],
      },
    ]
  },
}

export default nextConfig
