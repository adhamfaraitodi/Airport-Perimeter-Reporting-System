import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCookieCache, getSessionCookie } from "better-auth/cookies";
import { AUTH_SECRET, type UserRole } from "@/lib/auth";

export const ROLE_COOKIE_NAME = "perimeter_session_role";

export const PROTECTED_ROUTE_SEGMENTS = [
  "reports",
  "operator",
  "technician",
  "profile",
  "dashboard",
] as const;

export const PUBLIC_ROUTE_SEGMENTS = ["login"] as const;

export const ALL_KNOWN_ROUTES = [
  ...PROTECTED_ROUTE_SEGMENTS,
  ...PUBLIC_ROUTE_SEGMENTS,
] as const;

export interface AuthProxyContext {
  locale: string;
  routeSegment: string;
  subSegments: string[];
}

export function getHomeRouteForRole(
  locale: string,
  role?: UserRole | string | null
): string {
  switch (role) {
    case "OPERATOR":
      return `/${locale}/operator`;
    case "TECHNICIAN":
      return `/${locale}/technician`;
    case "REPORTER":
    default:
      return `/${locale}/reports`;
  }
}

function isValidRole(value: unknown): value is UserRole {
  return (
    value === "REPORTER" || value === "OPERATOR" || value === "TECHNICIAN"
  );
}

/**
 * Resolves the active session token and user role from Better-Auth cookies.
 */
export async function resolveProxySession(request: NextRequest): Promise<{
  isAuthenticated: boolean;
  role: UserRole | null;
}> {
  const sessionToken = getSessionCookie(request);
  const roleCookie = request.cookies.get(ROLE_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return {
      isAuthenticated: false,
      role: isValidRole(roleCookie) ? roleCookie : null,
    };
  }

  // Attempt to read signed Better-Auth cookie cache for role verification
  try {
    const cached = await getCookieCache(request, { secret: AUTH_SECRET });
    const cachedRole = (cached?.user as Record<string, unknown> | undefined)
      ?.role;
    if (isValidRole(cachedRole)) {
      return {
        isAuthenticated: true,
        role: cachedRole,
      };
    }
  } catch {
    // Fallback to role cookie if cookie cache decoding is unavailable
  }

  return {
    isAuthenticated: true,
    role: isValidRole(roleCookie) ? roleCookie : "REPORTER",
  };
}

/**
 * Child proxy handler invoked by root `proxy.ts`.
 * Handles Better-Auth session checks, `/dashboard` alias routing,
 * login redirect for authenticated users, and Role-Based Access Control (RBAC).
 */
export async function handleAuthProxy(
  request: NextRequest,
  context: AuthProxyContext
): Promise<NextResponse> {
  const { locale, routeSegment } = context;
  const { pathname, search } = request.nextUrl;

  const { isAuthenticated, role } = await resolveProxySession(request);

  // Enforce strict redirect to /login in production or when NEXT_PUBLIC_REQUIRE_AUTH="true"
  const enforceAuthRedirect =
    process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true" ||
    process.env.NODE_ENV === "production";

  // 1. Legacy `/[locale]/dashboard` alias -> redirect to role-appropriate home
  if (routeSegment === "dashboard") {
    const target = getHomeRouteForRole(locale, role);
    return NextResponse.redirect(new URL(`${target}${search}`, request.url));
  }

  // 2. Public route `/[locale]/login`: if already authenticated, redirect to role home
  if (routeSegment === "login") {
    if (isAuthenticated) {
      const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");
      const destination =
        callbackUrl && callbackUrl.startsWith(`/${locale}/`)
          ? callbackUrl
          : getHomeRouteForRole(locale, role);
      return NextResponse.redirect(new URL(destination, request.url));
    }
    return NextResponse.next();
  }

  // 3. Protected routes: check authentication when auth enforcement is enabled
  const isProtected = (PROTECTED_ROUTE_SEGMENTS as readonly string[]).includes(
    routeSegment
  );

  if (isProtected && !isAuthenticated && enforceAuthRedirect) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Role-Based Access Control (RBAC) when user is authenticated with a known role
  if (isAuthenticated && role) {
    if (routeSegment === "operator" && role !== "OPERATOR") {
      return NextResponse.redirect(
        new URL(getHomeRouteForRole(locale, role), request.url)
      );
    }

    if (
      routeSegment === "technician" &&
      role !== "TECHNICIAN" &&
      role !== "OPERATOR"
    ) {
      return NextResponse.redirect(
        new URL(getHomeRouteForRole(locale, role), request.url)
      );
    }

    if (routeSegment === "reports" && role !== "REPORTER") {
      return NextResponse.redirect(
        new URL(getHomeRouteForRole(locale, role), request.url)
      );
    }
  }

  return NextResponse.next();
}
