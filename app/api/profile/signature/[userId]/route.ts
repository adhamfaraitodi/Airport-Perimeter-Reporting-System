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

    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userRecord = session.user as Record<string, unknown>;
    if (userRecord.status === "INACTIVE") {
      return new NextResponse("Forbidden: Account inactive", { status: 403 });
    }

    // Enforce BOLA/IDOR protection: owner, OPERATOR, or TECHNICIAN (for official PDF report generation)
    const callerRole = userRecord.role as string | undefined;
    if (
      session.user.id !== userId &&
      callerRole !== "OPERATOR" &&
      callerRole !== "TECHNICIAN"
    ) {
      return new NextResponse("Forbidden", { status: 403 });
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
        "Cache-Control": "private, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    console.error("Error serving signature:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
