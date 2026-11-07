"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { createReportSchema, type CreateReportInput } from "./reports.schema";
import { createReport } from "./reports.service";

export async function createReportAction(input: CreateReportInput) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null);

  if (!session?.user?.id) {
    return { error: { _form: ["Sesi tidak valid. Silakan login kembali."] } };
  }

  const userRecord = session.user as Record<string, unknown>;
  if (userRecord.status === "INACTIVE") {
    return { error: { _form: ["Akun Anda telah dinonaktifkan."] } };
  }

  const parsed = createReportSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const created = await createReport(session.user.id, parsed.data);
  return { data: created };
}
