import { NextRequest, NextResponse } from "next/server";
import { getImageObject } from "@/lib/storage";

const ALLOWED_CATEGORIES = new Set(["avatars", "reports"]);
const SAFE_FILENAME_RE = /^[a-zA-Z0-9._-]+$/;

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await context.params;

  if (!Array.isArray(segments) || segments.length !== 2) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [category, fileName] = segments;

  if (
    !ALLOWED_CATEGORIES.has(category) ||
    !SAFE_FILENAME_RE.test(fileName) ||
    fileName.includes("..")
  ) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const object = await getImageObject({ category, fileName });
    if (!object) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new NextResponse(Buffer.from(object.body), {
      status: 200,
      headers: {
        "Content-Type": object.contentType,
        "Cache-Control": object.cacheControl,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[api/uploads] Failed to fetch object:", err);
    return NextResponse.json(
      { error: "Failed to load media" },
      { status: 500 }
    );
  }
}
