import { NextRequest, NextResponse } from "next/server";
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { ROLE_COOKIE_NAME } from "@/lib/proxy/auth-proxy";

const handler = toNextJsHandler(auth);

const STALE_COOKIES = [
  ROLE_COOKIE_NAME,
  "better-auth.session_token",
  "better-auth.session_data",
  "__Secure-better-auth.session_token",
  "__Secure-better-auth.session_data",
] as const;

export async function GET(request: NextRequest) {
  const response = await handler.GET(request);

  // If `/api/auth/get-session` returns null while the browser still holds auth cookies
  // (e.g., secret rotated or session deleted in DB), clear them so proxy.ts won't redirect-loop.
  if (request.nextUrl.pathname.endsWith("/get-session")) {
    const hasAuthCookie = STALE_COOKIES.some((name) =>
      Boolean(request.cookies.get(name)?.value)
    );
    if (hasAuthCookie) {
      const cloned = response.clone();
      const bodyText = await cloned.text().catch(() => "");
      if (bodyText.trim() === "null") {
        const nextRes = new NextResponse(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: new Headers(response.headers),
        });
        for (const name of STALE_COOKIES) {
          nextRes.cookies.delete(name);
        }
        return nextRes;
      }
    }
  }

  return response;
}

export async function POST(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Block public/anonymous account registration via HTTP API.
  // Accounts can only be provisioned by authenticated Operators via Server Actions.
  if (pathname.includes("/sign-up")) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message:
          "Pendaftaran akun publik dinonaktifkan. Hubungi Operator untuk pembuatan akun.",
      },
      { status: 403 }
    );
  }

  return handler.POST(request);
}
