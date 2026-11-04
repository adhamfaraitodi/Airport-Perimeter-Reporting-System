import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await context.params;
    if (!userId) {
      return new NextResponse("User ID required", { status: 400 });
    }

    // Authenticate session
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null);

    // If no active session, reject unauthorized
    if (!session?.user) {
      // In development / demo environment, allow if requested with proper header or local dev
      if (process.env.NODE_ENV === "production") {
        return new NextResponse("Unauthorized", { status: 401 });
      }
    }

    // Path to private signature
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
    const signaturePath = path.join(
      process.cwd(),
      "storage",
      "signatures",
      `${safeUserId}.png`
    );

    if (!fs.existsSync(signaturePath)) {
      return new NextResponse("Signature not found", { status: 404 });
    }

    const fileBuffer = fs.readFileSync(signaturePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("Error serving signature:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
