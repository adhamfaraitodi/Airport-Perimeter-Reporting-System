"use server";

import { createReportSchema, type CreateReportInput } from "./reports.schema";
import { createReport } from "./reports.service";

export async function createReportAction(input: CreateReportInput) {
  const parsed = createReportSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // TODO: Ambil userId dari Better-Auth session
  const userId = "stub-user-id";
  const created = await createReport(userId, parsed.data);
  return { data: created };
}
