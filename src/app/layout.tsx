import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/providers";

const montserrat = localFont({
  variable: "--font-montserrat",
  src: "../../assets/fonts/Montserrat-Variable.woff2",
  display: "swap",
});

const poppins = localFont({
  variable: "--font-poppins",
  src: "../../assets/fonts/Poppins-Variable.woff2",
  weight: "400",
  display: "swap",
});

const spaceMono = localFont({
  variable: "--font-space-mono",
  src: "../../assets/fonts/SpaceMono-Variable.woff2",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Multi-POS",
    template: "%s | Multi-POS",
  },
  description:
    "Sistema Multi-POS: punto de venta multi-sucursal, panel administrativo y portal de clientes.",
  applicationName: "Multi-POS",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${montserrat.variable} ${poppins.variable} ${spaceMono.variable}`}
    >
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}