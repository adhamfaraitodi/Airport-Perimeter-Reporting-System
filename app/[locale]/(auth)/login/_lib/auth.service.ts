import { cookies, headers } from "next/headers";
import { auth, nipToEmail, type UserRole } from "@/lib/auth";
import {
  getHomeRouteForRole,
  ROLE_COOKIE_NAME,
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

export async function authenticateWithNip(
  input: LoginInput
): Promise<AuthenticateResult> {
  const { nip, password, rememberMe = true, locale = "id" } = input;
  const reqHeaders = await headers();

  try {
    // 1. Try signing in via Better-Auth username plugin (where username = NIP)
    let response = await auth.api
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
      response = await auth.api.signInEmail({
        body: {
          email: nipToEmail(nip),
          password,
          rememberMe,
        },
        headers: reqHeaders,
      });
    }

    if (!response || !response.user) {
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

    const rawRole = userRecord.role as string | undefined;
    const role: UserRole =
      rawRole === "OPERATOR" || rawRole === "TECHNICIAN"
        ? rawRole
        : "REPORTER";

    // Store role cookie alongside Better-Auth session for fast proxy RBAC routing
    const cookieStore = await cookies();
    cookieStore.set(ROLE_COOKIE_NAME, role, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: rememberMe ? 60 * 60 * 24 * 7 : undefined,
    });

    return {
      success: true,
      user: {
        id: response.user.id,
        nip: (userRecord.nip as string) || nip,
        name: response.user.name,
        role,
      },
      redirectTo: getHomeRouteForRole(locale, role),
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
