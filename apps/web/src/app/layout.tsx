import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ToastProvider } from "@/components/client";
import "./globals.css";

const bricolage = localFont({ src: "../fonts/bricolage.woff2", variable: "--font-bricolage", weight: "200 800", display: "swap" });
const jersey15 = localFont({ src: "../fonts/jersey15.woff2", variable: "--font-jersey15", weight: "400", display: "swap" });
const jersey20 = localFont({ src: "../fonts/jersey20.woff2", variable: "--font-jersey20", weight: "400", display: "swap" });
const jetbrains = localFont({
  src: [
    { path: "../fonts/jetbrains-500.woff2", weight: "500" },
    { path: "../fonts/jetbrains-700.woff2", weight: "700" },
  ],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Reta · Torneos de TCG Pocket", template: "%s · Reta" },
  description: "Organiza y juega torneos de TCG Pocket: contraseña de partida automática, rangos por temporada y tu tarjeta de cazador.",
  applicationName: "Reta",
  appleWebApp: { capable: true, title: "Reta", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0E0E12",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX" className={`${bricolage.variable} ${jersey15.variable} ${jersey20.variable} ${jetbrains.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
