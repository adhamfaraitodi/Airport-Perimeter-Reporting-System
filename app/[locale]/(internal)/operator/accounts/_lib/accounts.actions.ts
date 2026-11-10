"use server";

import { headers } from "next/headers";
import { eq, desc } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db, schema } from "@/db";
import { auth, nipToEmail, type UserRole, type AccountStatus } from "@/lib/auth";
import type { ManagedAccount, AccountInput } from "../../../../_lib/accounts-store";
import {
  createAccountSchema,
  updateAccountSchema,
  toggleAccountStatusSchema,
  resetPasswordSchema,
  deleteAccountSchema,
} from "./accounts.schema";

export interface CreateAccountInput extends AccountInput {
  password: string;
}

async function verifyOperatorSession() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null);

  if (!session?.user?.id) {
    throw new Error("Sesi tidak valid. Silakan login kembali.");
  }

  const userRecord = session.user as Record<string, unknown>;
  const role = userRecord.role as string | undefined;
  const status = userRecord.status as string | undefined;

  if (status === "INACTIVE") {
    throw new Error("Akun Anda telah dinonaktifkan.");
  }

  if (role !== "OPERATOR") {
    throw new Error("Akses ditolak. Hanya Operator yang dapat mengelola akun.");
  }

  return session.user;
}

/**
 * Fetch all user accounts from PostgreSQL database.
 */
export async function getAccountsAction(): Promise<{
  success: boolean;
  accounts: ManagedAccount[];
  errorMessage?: string;
}> {
  try {
    await verifyOperatorSession();

    const records = await db
      .select({
        id: schema.user.id,
        nip: schema.user.nip,
        name: schema.user.name,
        email: schema.user.email,
        phone: schema.user.phone,
        avatarUrl: schema.user.image,
        role: schema.user.role,
        position: schema.user.position,
        unit: schema.user.unit,
        status: schema.user.status,
        createdAt: schema.user.createdAt,
      })
      .from(schema.user)
      .orderBy(desc(schema.user.createdAt));

    const accounts: ManagedAccount[] = records.map((r) => ({
      id: r.id,
      nip: r.nip,
      name: r.name,
      email: r.email,
      phone: r.phone || "-",
      avatarUrl: r.avatarUrl,
      role: r.role as UserRole,
      position: r.position || "Officer",
      unit: r.unit,
      status: r.status as AccountStatus,
      createdAt: r.createdAt.toISOString(),
    }));

    return { success: true, accounts };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memuat daftar akun.";
    return { success: false, accounts: [], errorMessage: msg };
  }
}

/**
 * Create a new user account with Better-Auth credentials.
 * Validates input via Zod createAccountSchema.
 */
export async function createAccountAction(
  input: CreateAccountInput
): Promise<{
  success: boolean;
  account?: ManagedAccount;
  errorMessage?: string;
}> {
  try {
    await verifyOperatorSession();

    const parsed = createAccountSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      return { success: false, errorMessage: firstError || "Data akun baru tidak valid." };
    }

    const { nip, name, phone, unit, role, position, status, password } = parsed.data;

    // Check duplicate NIP
    const existing = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.nip, nip))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, errorMessage: `NIP ${nip} sudah terdaftar pada akun lain.` };
    }

    const email = nipToEmail(nip);
    const resolvedPosition = position || "Officer";

    // Create via Better-Auth signUpEmail
    const res = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
        nip,
        unit,
        position: resolvedPosition,
        phone: phone || undefined,
      },
    });

    const newUserId = res?.user?.id;
    if (!newUserId) {
      return { success: false, errorMessage: "Gagal membuat akun melalui Better-Auth." };
    }

    // Explicitly set role, status, position, username & displayUsername in database
    await db
      .update(schema.user)
      .set({
        role,
        status,
        position: resolvedPosition,
        username: nip,
        displayUsername: name,
      })
      .where(eq(schema.user.id, newUserId));

    const created: ManagedAccount = {
      id: newUserId,
      nip,
      name,
      email,
      phone: phone || "-",
      avatarUrl: null,
      role,
      position: resolvedPosition,
      unit,
      status,
      createdAt: new Date().toISOString(),
    };

    return { success: true, account: created };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal membuat akun baru.";
    return { success: false, errorMessage: msg };
  }
}

/**
 * Update an existing user account.
 * Validates input via Zod updateAccountSchema.
 */
export async function updateAccountAction(
  id: string,
  input: AccountInput
): Promise<{
  success: boolean;
  account?: ManagedAccount;
  errorMessage?: string;
}> {
  try {
    const currentUser = await verifyOperatorSession();

    const parsed = updateAccountSchema.safeParse({ id, ...input });
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      return { success: false, errorMessage: firstError || "Data pembaruan akun tidak valid." };
    }

    const { nip, name, phone, unit, role, position, status } = parsed.data;

    if (currentUser.id === id && (role !== "OPERATOR" || status === "INACTIVE")) {
      return {
        success: false,
        errorMessage: "Anda tidak dapat menurunkan peran atau menonaktifkan akun Anda sendiri.",
      };
    }

    // Check duplicate NIP if changed
    const existingNip = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.nip, nip))
      .limit(1);

    if (existingNip.length > 0 && existingNip[0].id !== id) {
      return { success: false, errorMessage: `NIP ${nip} sudah terdaftar pada akun lain.` };
    }

    const email = nipToEmail(nip);
    const resolvedPosition = position || "Officer";

    await db.transaction(async (tx) => {
      await tx
        .update(schema.user)
        .set({
          name,
          nip,
          email,
          phone: phone || null,
          role,
          position: resolvedPosition,
          unit,
          status,
          username: nip,
          displayUsername: name,
          updatedAt: new Date(),
        })
        .where(eq(schema.user.id, id));

      // Revoke active sessions if status becomes INACTIVE
      if (status === "INACTIVE") {
        await tx.delete(schema.session).where(eq(schema.session.userId, id));
      }
    });

    const updated: ManagedAccount = {
      id,
      nip,
      name,
      email,
      phone: phone || "-",
      avatarUrl: input.avatarUrl ?? null,
      role,
      position: resolvedPosition,
      unit,
      status,
      createdAt: new Date().toISOString(),
    };

    return { success: true, account: updated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memperbarui akun.";
    return { success: false, errorMessage: msg };
  }
}

/**
 * Toggle account status between ACTIVE and INACTIVE.
 * Validates input via Zod toggleAccountStatusSchema.
 */
export async function toggleAccountStatusAction(
  id: string,
  newStatus: AccountStatus
): Promise<{
  success: boolean;
  status?: AccountStatus;
  errorMessage?: string;
}> {
  try {
    const currentUser = await verifyOperatorSession();

    const parsed = toggleAccountStatusSchema.safeParse({ id, newStatus });
    if (!parsed.success) {
      return { success: false, errorMessage: "Status akun tidak valid." };
    }

    if (currentUser.id === id) {
      return {
        success: false,
        errorMessage: "Anda tidak dapat menonaktifkan akun Anda sendiri yang sedang aktif.",
      };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(schema.user)
        .set({
          status: parsed.data.newStatus,
          updatedAt: new Date(),
        })
        .where(eq(schema.user.id, id));

      // Immediately revoke all active sessions when an account is deactivated
      if (parsed.data.newStatus === "INACTIVE") {
        await tx.delete(schema.session).where(eq(schema.session.userId, id));
      }
    });

    return { success: true, status: parsed.data.newStatus };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal mengubah status akun.";
    return { success: false, errorMessage: msg };
  }
}

/**
 * Reset password for a user account.
 * Validates input via Zod resetPasswordSchema.
 */
export async function resetAccountPasswordAction(
  id: string,
  newPassword: string
): Promise<{
  success: boolean;
  errorMessage?: string;
}> {
  try {
    await verifyOperatorSession();

    const parsed = resetPasswordSchema.safeParse({ id, newPassword });
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      return { success: false, errorMessage: firstError || "Password tidak valid." };
    }

    const hashedPassword = await hashPassword(parsed.data.newPassword);

    await db.transaction(async (tx) => {
      // Update password in Better-Auth account table
      await tx
        .update(schema.account)
        .set({
          password: hashedPassword,
          updatedAt: new Date(),
        })
        .where(eq(schema.account.userId, id));

      // Revoke existing sessions on password reset
      await tx.delete(schema.session).where(eq(schema.session.userId, id));
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal mereset password akun.";
    return { success: false, errorMessage: msg };
  }
}

/**
 * Delete a user account from PostgreSQL.
 * Validates input via Zod deleteAccountSchema.
 */
export async function deleteAccountAction(
  id: string
): Promise<{
  success: boolean;
  errorMessage?: string;
}> {
  try {
    const currentUser = await verifyOperatorSession();

    const parsed = deleteAccountSchema.safeParse({ id });
    if (!parsed.success) {
      return { success: false, errorMessage: "ID akun tidak valid." };
    }

    if (currentUser.id === id) {
      return {
        success: false,
        errorMessage: "Anda tidak dapat menghapus akun Anda sendiri.",
      };
    }

    await db.delete(schema.user).where(eq(schema.user.id, id));

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menghapus akun.";
    return { success: false, errorMessage: msg };
  }
}
