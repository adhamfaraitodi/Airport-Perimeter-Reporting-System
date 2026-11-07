import { cookies, headers } from "next/headers";
import { auth, nipToEmail, type UserRole } from "@/lib/auth";
import {
  getHomeRouteForRole,
  ROLE_COOKIE_NAME,
  signRoleCookie,
} from "@/lib/proxy/auth-proxy";
import type { LoginInput } from "./auth.schema";

export interface AuthenticateResult {
  success: boolean;
  redirectTo?: string;
  user?: {
    id: string;
    nip: string;
    name: string;
    role: UserRole;
  };
  errorMessage?: string;
  dbUnavailable?: boolean;
}

// Simple in-memory rate limiter for brute-force protection on login (5 failed attempts per 5 minutes per NIP)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 5 * 60 * 1000;

function checkRateLimit(key: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(key);

  if (!entry || now > entry.resetAt) {
    return { allowed: true };
  }

  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  return { allowed: true };
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOCKOUT_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function clearFailedAttempts(key: string) {
  loginAttempts.delete(key);
}

export async function authenticateWithNip(
  input: LoginInput
): Promise<AuthenticateResult> {
  const { nip, password, rememberMe = true, locale = "id", callbackUrl } = input;
  const reqHeaders = await headers();
  const rateKey = nip.trim();

  const rateCheck = checkRateLimit(rateKey);
  if (!rateCheck.allowed) {
    return {
      success: false,
      errorMessage: `Terlalu banyak percobaan login gagal. Silakan coba lagi dalam ${rateCheck.retryAfterSec} detik.`,
    };
  }

  try {
    // 1. Try signing in via Better-Auth username plugin (where username = NIP)
    let response:
      | Awaited<ReturnType<typeof auth.api.signInUsername>>
      | Awaited<ReturnType<typeof auth.api.signInEmail>>
      | null = await auth.api
      .signInUsername({
        body: {
          username: nip,
          password,
          rememberMe,
        },
        headers: reqHeaders,
      })
      .catch(() => null);

    // 2. Fallback: sign in via deterministic NIP email if user was registered via emailAndPassword
    if (!response) {
      response = await auth.api
        .signInEmail({
          body: {
            email: nipToEmail(nip),
            password,
            rememberMe,
          },
          headers: reqHeaders,
        })
        .catch(() => null);
    }

    if (!response || !response.user) {
      recordFailedAttempt(rateKey);
      return {
        success: false,
        errorMessage: "NIP atau password yang Anda masukkan tidak sesuai.",
      };
    }

    const userRecord = response.user as Record<string, unknown>;
    const status = (userRecord.status as string) || "ACTIVE";

    if (status === "INACTIVE") {
      await auth.api.signOut({ headers: reqHeaders }).catch(() => null);
      return {
        success: false,
        errorMessage:
          "Akun Anda berstatus nonaktif. Silakan hubungi operator website.",
      };
    }

    clearFailedAttempts(rateKey);

    const rawRole = userRecord.role as string | undefined;
    const role: UserRole =
      rawRole === "OPERATOR" || rawRole === "TECHNICIAN"
        ? rawRole
        : "REPORTER";

    // Store HMAC-signed role cookie alongside Better-Auth session for fast proxy RBAC routing
    const cookieStore = await cookies();
    cookieStore.set(ROLE_COOKIE_NAME, signRoleCookie(role), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: rememberMe ? 60 * 60 * 24 * 7 : undefined,
    });

    // Check if callbackUrl is safe and permitted for this role
    let redirectTo = getHomeRouteForRole(locale, role);
    if (
      callbackUrl &&
      callbackUrl.startsWith(`/${locale}/`) &&
      !callbackUrl.startsWith(`/${locale}/login`)
    ) {
      const isOperatorRoute = callbackUrl.startsWith(`/${locale}/operator`);
      const isTechnicianRoute = callbackUrl.startsWith(`/${locale}/technician`);
      const isReportsRoute = callbackUrl.startsWith(`/${locale}/reports`);

      if (isOperatorRoute && role === "OPERATOR") {
        redirectTo = callbackUrl;
      } else if (
        isTechnicianRoute &&
        (role === "TECHNICIAN" || role === "OPERATOR")
      ) {
        redirectTo = callbackUrl;
      } else if (isReportsRoute && role === "REPORTER") {
        redirectTo = callbackUrl;
      } else if (!isOperatorRoute && !isTechnicianRoute && !isReportsRoute) {
        redirectTo = callbackUrl;
      }
    }

    return {
      success: true,
      user: {
        id: String(response.user.id),
        nip: (userRecord.nip as string) || nip,
        name: response.user.name,
        role,
      },
      redirectTo,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isConnectionError =
      /ECONNREFUSED|connect|database|relation .* does not exist/i.test(msg);

    if (isConnectionError) {
      return {
        success: false,
        dbUnavailable: true,
        errorMessage:
          "Database PostgreSQL belum terhubung atau belum dimigrasi.",
      };
    }

    recordFailedAttempt(rateKey);
    return {
      success: false,
      errorMessage: "NIP atau password yang Anda masukkan tidak sesuai.",
    };
  }
}

export async function signOutWithBetterAuth() {
  const reqHeaders = await headers();
  const cookieStore = await cookies();

  try {
    await auth.api.signOut({ headers: reqHeaders });
  } catch {
    // Ignore if session was already expired or DB unreachable
  }

  // Ensure all Better-Auth session/cache cookies and RBAC role cookie are cleared
  const cookiesToClear = [
    ROLE_COOKIE_NAME,
    "better-auth.session_token",
    "better-auth.session_data",
    "__Secure-better-auth.session_token",
    "__Secure-better-auth.session_data",
  ];

  for (const name of cookiesToClear) {
    cookieStore.delete(name);
  }

  return { success: true };
}
