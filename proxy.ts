import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const SUPPORTED_LOCALES = ["id", "en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = "id";

const KNOWN_ROUTES = ["reports", "dashboard", "login"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Root path -> redirect ke default locale reports
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(`/${DEFAULT_LOCALE}/reports${search}`, request.url)
    );
  }

  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];

  // 1. Jika locale sudah valid ('id' atau 'en'), izinkan lewat
  if (SUPPORTED_LOCALES.includes(first as SupportedLocale)) {
    return NextResponse.next();
  }

  // 2. Jika user mengakses route group tanpa tanda kurung (misal /internal/reports atau /auth/login)
  if (first === "internal" || first === "auth") {
    const remaining = segments.slice(1).join("/");
    const destination = remaining || "reports";
    return NextResponse.redirect(
      new URL(`/${DEFAULT_LOCALE}/${destination}${search}`, request.url)
    );
  }

  // 3. Jika user mengakses route langsung tanpa locale (misal /reports, /dashboard, /login)
  if (KNOWN_ROUTES.includes(first)) {
    return NextResponse.redirect(
      new URL(`/${DEFAULT_LOCALE}/${segments.join("/")}${search}`, request.url)
    );
  }

  // 4. Jika user mengetik locale yang tidak valid (misal /fr/reports, /jp/dashboard)
  if (segments.length > 1 && KNOWN_ROUTES.includes(segments[1])) {
    const targetPath = segments.slice(1).join("/");
    return NextResponse.redirect(
      new URL(`/${DEFAULT_LOCALE}/${targetPath}${search}`, request.url)
    );
  }

  // Fallback default: lempar ke /[defaultLocale]/reports
  return NextResponse.redirect(
    new URL(`/${DEFAULT_LOCALE}/reports${search}`, request.url)
  );
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (/api/...)
     * - _next static files and images (/_next/static/..., /_next/image/...)
     * - static files (.ico, .webp, .png, .jpg, .svg, .css, .js, etc.)
     */
    "/((?!api|_next/static|_next/image|.*\\..*).*)",
  ],
};
