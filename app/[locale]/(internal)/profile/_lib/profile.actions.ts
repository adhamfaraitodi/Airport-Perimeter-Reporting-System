"use server";

import fs from "fs";
import path from "path";
import sharp from "sharp";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { auth, type UserRole } from "@/lib/auth";
import { updateProfileSchema } from "./profile.schema";

export interface ProfileData {
  id: string;
  name: string;
  nip: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  unit: string;
  status: string;
  image?: string | null;
  signatureUrl?: string | null;
  createdAt?: string;
}

export interface UpdateProfileInput {
  name: string;
  phone?: string | null;
  avatarDataUrl?: string | null; // Base64 dataUrl or null to remove
  signatureDataUrl?: string | null; // Base64 dataUrl or null to remove
}

export interface UpdateProfileResult {
  success: boolean;
  user?: ProfileData;
  errorMessage?: string;
}

/**
 * Fetch current authenticated user profile directly from PostgreSQL DB.
 */
export async function getProfileAction(): Promise<{
  success: boolean;
  user?: ProfileData;
  errorMessage?: string;
}> {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null);

    const targetUserId = session?.user?.id;

    if (!targetUserId) {
      return { success: false, errorMessage: "Sesi pengguna tidak valid. Silakan login kembali." };
    }

    const record = await db.query.user.findFirst({
      where: eq(schema.user.id, targetUserId),
    });

    if (!record || record.status === "INACTIVE") {
      return { success: false, errorMessage: "Data profil tidak ditemukan atau akun nonaktif." };
    }

    return {
      success: true,
      user: {
        id: record.id,
        name: record.name,
        nip: record.nip,
        email: record.email,
        role: record.role as UserRole,
        phone: record.phone,
        unit: record.unit,
        status: record.status,
        image: record.image,
        signatureUrl: record.signatureUrl,
        createdAt: record.createdAt?.toISOString(),
      },
    };
  } catch (err) {
    console.error("getProfileAction error:", err);
    return {
      success: false,
      errorMessage: "Gagal memuat profil pengguna dari database.",
    };
  }
}

/**
 * Autonomous Update Profile:
 * - Updates name, phone
 * - Saves compressed WebP avatar to public/uploads/avatars/
 * - Saves processed wet signature to private storage/signatures/
 * - Persists updates to PostgreSQL `user` table
 * - Validates input via Zod updateProfileSchema
 */
export async function updateProfileAction(
  input: UpdateProfileInput
): Promise<UpdateProfileResult> {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null);

    const targetUserId = session?.user?.id;

    if (!targetUserId) {
      return { success: false, errorMessage: "Sesi pengguna tidak valid. Silakan login kembali." };
    }

    const parsed = updateProfileSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      return { success: false, errorMessage: firstError || "Data profil tidak valid." };
    }

    const existing = await db.query.user.findFirst({
      where: eq(schema.user.id, targetUserId),
    });

    if (!existing || existing.status === "INACTIVE") {
      return { success: false, errorMessage: "Akun pengguna tidak ditemukan atau nonaktif." };
    }

    let finalImageUrl = existing.image;
    let finalSignatureUrl = existing.signatureUrl;

    // 1. Process Avatar
    if (parsed.data.avatarDataUrl !== undefined) {
      if (parsed.data.avatarDataUrl === null) {
        // Remove existing avatar file
        finalImageUrl = null;
        const oldFile = path.join(
          process.cwd(),
          "public",
          "uploads",
          "avatars",
          `${targetUserId}.webp`
        );
        if (fs.existsSync(oldFile)) {
          fs.unlinkSync(oldFile);
        }
      } else if (parsed.data.avatarDataUrl.startsWith("data:image/")) {
        // Save avatar file converted to genuine WebP (512x512 cover, quality 85)
        const base64Data = parsed.data.avatarDataUrl.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const dir = path.join(process.cwd(), "public", "uploads", "avatars");
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const filePath = path.join(dir, `${targetUserId}.webp`);
        const webpBuffer = await sharp(buffer)
          .rotate()
          .resize(512, 512, { fit: "cover" })
          .webp({ quality: 85, effort: 4 })
          .toBuffer();
        fs.writeFileSync(filePath, webpBuffer);
        finalImageUrl = `/uploads/avatars/${targetUserId}.webp?t=${Date.now()}`;
      }
    }

    // 2. Process Private Signature
    if (parsed.data.signatureDataUrl !== undefined) {
      if (parsed.data.signatureDataUrl === null) {
        // Remove existing signature file
        finalSignatureUrl = null;
        const oldSign = path.join(
          process.cwd(),
          "storage",
          "signatures",
          `${targetUserId}.png`
        );
        if (fs.existsSync(oldSign)) {
          fs.unlinkSync(oldSign);
        }
      } else if (parsed.data.signatureDataUrl.startsWith("data:image/")) {
        // Save signature file in private storage
        const base64Data = parsed.data.signatureDataUrl.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const dir = path.join(process.cwd(), "storage", "signatures");
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const filePath = path.join(dir, `${targetUserId}.png`);
        fs.writeFileSync(filePath, buffer);
        finalSignatureUrl = `/api/profile/signature/${targetUserId}?t=${Date.now()}`;
      }
    }

    // 3. Update PostgreSQL
    const [updated] = await db
      .update(schema.user)
      .set({
        name: parsed.data.name.trim(),
        phone: parsed.data.phone ? parsed.data.phone.trim() : null,
        image: finalImageUrl,
        signatureUrl: finalSignatureUrl,
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, targetUserId))
      .returning();

    return {
      success: true,
      user: {
        id: updated.id,
        name: updated.name,
        nip: updated.nip,
        email: updated.email,
        role: updated.role as UserRole,
        phone: updated.phone,
        unit: updated.unit,
        status: updated.status,
        image: updated.image,
        signatureUrl: updated.signatureUrl,
        createdAt: updated.createdAt?.toISOString(),
      },
    };
  } catch (err) {
    console.error("updateProfileAction error:", err);
    return {
      success: false,
      errorMessage: "Gagal menyimpan perubahan profil ke database.",
    };
  }
}

/**
 * Retrieve user's signature as Base64 Data URL for embedding into generated PDF reports.
 * Enforces ownership, Operator, or Technician privilege.
 */
export async function getUserSignatureDataUrl(
  userId: string
): Promise<string | null> {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null);

    if (!session?.user?.id) {
      return null;
    }

    const userRecord = session.user as Record<string, unknown>;
    if (userRecord.status === "INACTIVE") {
      return null;
    }

    const callerRole = userRecord.role as string | undefined;
    if (
      session.user.id !== userId &&
      callerRole !== "OPERATOR" &&
      callerRole !== "TECHNICIAN"
    ) {
      return null;
    }

    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
    const signPath = path.join(
      process.cwd(),
      "storage",
      "signatures",
      `${safeUserId}.png`
    );
    if (!fs.existsSync(signPath)) {
      return null;
    }
    const buf = fs.readFileSync(signPath);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
