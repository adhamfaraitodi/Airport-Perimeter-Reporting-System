import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCookieCache, getSessionCookie } from "better-auth/cookies";
import { AUTH_SECRET, type UserRole } from "@/lib/auth";

export const ROLE_COOKIE_NAME = "perimeter_session_role";

const AUTH_COOKIES_TO_CLEAR = [
  ROLE_COOKIE_NAME,
  "better-auth.session_token",
  "better-auth.session_data",
  "__Secure-better-auth.session_token",
  "__Secure-better-auth.session_data",
] as const;

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
 * Signs the user's role using HMAC-SHA256 with AUTH_SECRET so the role cookie
 * cannot be forged or tampered with by the client.
 */
export function signRoleCookie(role: UserRole): string {
  const sig = createHmac("sha256", AUTH_SECRET)
    .update(role)
    .digest("base64url");
  return `${role}.${sig}`;
}

/**
 * Verifies and extracts the role from a signed role cookie.
 * Returns null if unsigned, malformed, or tampered.
 */
export function verifyRoleCookie(cookieValue?: string | null): UserRole | null {
  if (!cookieValue) return null;
  const dotIdx = cookieValue.indexOf(".");
  if (dotIdx === -1) return null;

  const rawRole = cookieValue.slice(0, dotIdx);
  const sig = cookieValue.slice(dotIdx + 1);
  if (!isValidRole(rawRole) || !sig) return null;

  const expectedSig = createHmac("sha256", AUTH_SECRET)
    .update(rawRole)
    .digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;

  if (!timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  return rawRole;
}

/**
 * Verifies the Better-Auth `better-auth.session_token` HMAC-SHA256 signature
 * (`<token>.<44-char base64 signature>`).
 * Returns the raw token if valid, or null if forged/signed with an old secret.
 */
export function verifySessionTokenCookie(
  rawCookieValue?: string | null
): string | null {
  if (!rawCookieValue) return null;

  let decoded = rawCookieValue;
  try {
    decoded = decodeURIComponent(rawCookieValue);
  } catch {
    return null;
  }

  const dotIdx = decoded.lastIndexOf(".");
  if (dotIdx < 1) return null;

  const tokenValue = decoded.slice(0, dotIdx);
  const signature = decoded.slice(dotIdx + 1);
  if (signature.length !== 44 || !signature.endsWith("=")) {
    return null;
  }

  const expectedSig = createHmac("sha256", AUTH_SECRET)
    .update(tokenValue)
    .digest("base64");

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;

  if (!timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  return tokenValue;
}

function clearAuthCookiesOnResponse(response: NextResponse): NextResponse {
  for (const name of AUTH_COOKIES_TO_CLEAR) {
    response.cookies.delete(name);
  }
  return response;
}

/**
 * Resolves the active session token and user role from Better-Auth cookies.
 */
export async function resolveProxySession(request: NextRequest): Promise<{
  isAuthenticated: boolean;
  role: UserRole | null;
  hasStaleCookies: boolean;
}> {
  const rawSessionCookie = getSessionCookie(request);
  const verifiedToken = verifySessionTokenCookie(rawSessionCookie);
  const verifiedRoleCookie = verifyRoleCookie(
    request.cookies.get(ROLE_COOKIE_NAME)?.value
  );

  if (!verifiedToken) {
    return {
      isAuthenticated: false,
      role: null,
      hasStaleCookies: Boolean(
        rawSessionCookie || request.cookies.get(ROLE_COOKIE_NAME)?.value
      ),
    };
  }

  // Attempt to read signed Better-Auth cookie cache for role verification
  try {
    const cached = await getCookieCache(request, { secret: AUTH_SECRET });
    const cachedUser = cached?.user as Record<string, unknown> | undefined;
    if (cachedUser?.status === "INACTIVE") {
      return {
        isAuthenticated: false,
        role: null,
        hasStaleCookies: true,
      };
    }

    const cachedRole = cachedUser?.role;
    if (isValidRole(cachedRole)) {
      return {
        isAuthenticated: true,
        role: cachedRole,
        hasStaleCookies: false,
      };
    }
  } catch {
    // Fallback to verified HMAC-signed role cookie if cookie cache decoding is unavailable
  }

  // Require either a valid cookie cache or a valid HMAC-signed role cookie
  if (!verifiedRoleCookie) {
    return {
      isAuthenticated: false,
      role: null,
      hasStaleCookies: true,
    };
  }

  return {
    isAuthenticated: true,
    role: verifiedRoleCookie,
    hasStaleCookies: false,
  };
}

/**
 * Child proxy handler invoked by root `proxy.ts`.
 * Handles Better-Auth session checks, `/dashboard` alias routing,
 * login redirect for unauthenticated users, and Role-Based Access Control (RBAC).
 */
export async function handleAuthProxy(
  request: NextRequest,
  context: AuthProxyContext
): Promise<NextResponse> {
  const { locale, routeSegment } = context;
  const { pathname, search } = request.nextUrl;

  const { isAuthenticated, role, hasStaleCookies } =
    await resolveProxySession(request);

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
        callbackUrl &&
        callbackUrl.startsWith(`/${locale}/`) &&
        !callbackUrl.startsWith(`/${locale}/login`)
          ? callbackUrl
          : getHomeRouteForRole(locale, role);
      return NextResponse.redirect(new URL(destination, request.url));
    }
    const response = NextResponse.next();
    return hasStaleCookies ? clearAuthCookiesOnResponse(response) : response;
  }

  // 3. Protected routes: ALWAYS enforce authentication -> kick unauthenticated to login
  const isProtected = (PROTECTED_ROUTE_SEGMENTS as readonly string[]).includes(
    routeSegment
  );

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    const response = NextResponse.redirect(loginUrl);
    return hasStaleCookies ? clearAuthCookiesOnResponse(response) : response;
  }

  // 4. Role-Based Access Control (RBAC) when user is authenticated with a known role
  if (isAuthenticated && role) {
    if (routeSegment === "operator" && role !== "OPERATOR") {
      return NextResponse.redirect(
        new URL(getHomeRouteForRole(locale, role), request.url)
      );
    }

    if (routeSegment === "technician" && role !== "TECHNICIAN") {
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
