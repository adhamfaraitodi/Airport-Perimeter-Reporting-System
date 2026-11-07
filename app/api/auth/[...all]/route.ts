import { NextRequest, NextResponse } from "next/server";
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;

export async function POST(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Block public/anonymous account registration via HTTP API.
  // Accounts can only be provisioned by authenticated Operators via Server Actions.
  if (pathname.includes("/sign-up")) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: "Pendaftaran akun publik dinonaktifkan. Hubungi Operator untuk pembuatan akun.",
      },
      { status: 403 }
    );
  }

  return handler.POST(request);
}
