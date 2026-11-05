import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
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

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("perimeter-theme")?.value;
  const initialTheme = themeCookie === "dark" ? "dark" : "light";
  const isDark = initialTheme === "dark";

  return (
    <html
      lang="id"
      data-theme={initialTheme}
      className={`h-full antialiased ${isDark ? "dark" : ""}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='perimeter-theme';var s=localStorage.getItem(k);var p=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=(s==='light'||s==='dark')?s:(p?'dark':'light');document.documentElement.setAttribute('data-theme',t);if(t==='dark'){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}document.cookie=k+'='+t+';path=/;max-age=31536000;SameSite=Lax'}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-['Carlito',sans-serif]">
        {children}
      </body>
    </html>
  );
}
