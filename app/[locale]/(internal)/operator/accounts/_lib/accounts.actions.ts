"use server";

import { headers } from "next/headers";
import { eq, desc } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db, schema } from "@/db";
import { auth, nipToEmail, type UserRole, type AccountStatus } from "@/lib/auth";
import type { ManagedAccount, AccountInput } from "../../../../_lib/accounts-store";

export interface CreateAccountInput extends AccountInput {
  password: string;
}

async function verifyOperatorSession() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null);

  if (!session?.user?.id) {
    throw new Error("Sesi tidak valid. Silakan login kembali.");
  }

  const role = (session.user as Record<string, unknown>).role as string | undefined;
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

    const nip = input.nip.trim();
    const name = input.name.trim();
    const phone = input.phone?.trim() || "";
    const unit = input.unit.trim() || "Operasional Bandara";
    const role = input.role;
    const status = input.status || "ACTIVE";
    const password = input.password.trim();

    if (!nip || !name) {
      return { success: false, errorMessage: "NIP dan Nama Lengkap wajib diisi." };
    }

    if (!password || password.length < 6) {
      return { success: false, errorMessage: "Password minimal 6 karakter." };
    }

    if (phone && (phone.length < 10 || phone.length > 13 || !/^\d+$/.test(phone))) {
      return {
        success: false,
        errorMessage: "Nomor telepon harus berupa angka antara 10 sampai 13 digit.",
      };
    }

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

    // Create via Better-Auth signUpEmail
    const res = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
        nip,
        role,
        unit,
        phone,
        status,
      },
    });

    const newUserId = res?.user?.id;
    if (!newUserId) {
      return { success: false, errorMessage: "Gagal membuat akun melalui Better-Auth." };
    }

    // Sync username & displayUsername for username plugin
    await db
      .update(schema.user)
      .set({
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
    await verifyOperatorSession();

    const nip = input.nip.trim();
    const name = input.name.trim();
    const phone = input.phone?.trim() || "";
    const unit = input.unit.trim() || "Operasional Bandara";
    const role = input.role;
    const status = input.status;

    if (!nip || !name) {
      return { success: false, errorMessage: "NIP dan Nama Lengkap wajib diisi." };
    }

    if (phone && (phone.length < 10 || phone.length > 13 || !/^\d+$/.test(phone))) {
      return {
        success: false,
        errorMessage: "Nomor telepon harus berupa angka antara 10 sampai 13 digit.",
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

    await db
      .update(schema.user)
      .set({
        name,
        nip,
        email,
        phone,
        role,
        unit,
        status,
        username: nip,
        displayUsername: name,
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, id));

    const updated: ManagedAccount = {
      id,
      nip,
      name,
      email,
      phone: phone || "-",
      avatarUrl: input.avatarUrl ?? null,
      role,
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

    if (currentUser.id === id) {
      return {
        success: false,
        errorMessage: "Anda tidak dapat menonaktifkan akun Anda sendiri yang sedang aktif.",
      };
    }

    await db
      .update(schema.user)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, id));

    return { success: true, status: newStatus };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal mengubah status akun.";
    return { success: false, errorMessage: msg };
  }
}

/**
 * Reset password for a user account.
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

    const trimmed = newPassword.trim();
    if (trimmed.length < 6) {
      return { success: false, errorMessage: "Password baru minimal 6 karakter." };
    }

    const hashedPassword = await hashPassword(trimmed);

    // Update password in Better-Auth account table
    await db
      .update(schema.account)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(schema.account.userId, id));

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal mereset password akun.";
    return { success: false, errorMessage: msg };
  }
}

/**
 * Delete a user account from PostgreSQL.
 */
export async function deleteAccountAction(
  id: string
): Promise<{
  success: boolean;
  errorMessage?: string;
}> {
  try {
    const currentUser = await verifyOperatorSession();

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
