import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/carlito/400.css";
import "@fontsource/carlito/700.css";
import "@fontsource/carlito/400-italic.css";
import "@fontsource/carlito/700-italic.css";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Airport Perimeter Reporting System — YIA",
  description:
    "Sistem pelaporan kondisi pagar perimeter Bandara Internasional Yogyakarta (YIA)",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-['Carlito',sans-serif]">
        {children}
      </body>
    </html>
  );
}
