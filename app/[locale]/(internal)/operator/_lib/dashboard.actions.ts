"use server";

import { headers } from "next/headers";
import { auth, type UserRole } from "@/lib/auth";
import {
  closeReportSchema,
  updateReportStatusSchema,
  type CloseReportInput,
  type UpdateReportStatusInput,
} from "./dashboard.schema";
import { closeReport, updateReportStatus } from "./dashboard.service";

async function verifyAuth(allowedRoles: UserRole[]) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null);

  if (!session?.user?.id) {
    throw new Error("Sesi tidak valid. Silakan login kembali.");
  }

  const role = (session.user as Record<string, unknown>).role as UserRole | undefined;
  if (!role || !allowedRoles.includes(role)) {
    throw new Error("Akses ditolak. Anda tidak memiliki izin untuk tindakan ini.");
  }

  return session.user;
}

export async function updateReportStatusAction(input: UpdateReportStatusInput) {
  const parsed = updateReportStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  try {
    const user = await verifyAuth(["OPERATOR", "TECHNICIAN"]);
    const result = await updateReportStatus(user.id, parsed.data);
    return { data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memperbarui status laporan.";
    return { error: { _form: [msg] } };
  }
}

export async function closeReportAction(input: CloseReportInput) {
  const parsed = closeReportSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  try {
    const user = await verifyAuth(["OPERATOR"]);
    const result = await closeReport(user.id, parsed.data);
    return { data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menutup laporan.";
    return { error: { _form: [msg] } };
  }
}
