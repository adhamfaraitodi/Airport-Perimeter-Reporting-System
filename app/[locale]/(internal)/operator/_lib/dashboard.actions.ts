"use server";

import {
  closeReportSchema,
  updateReportStatusSchema,
  type CloseReportInput,
  type UpdateReportStatusInput,
} from "./dashboard.schema";
import { closeReport, updateReportStatus } from "./dashboard.service";

export async function updateReportStatusAction(input: UpdateReportStatusInput) {
  const parsed = updateReportStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // TODO: Verifikasi role OPERATOR / TECHNICIAN dari Better-Auth session
  const actorUserId = "stub-operator-id";
  const result = await updateReportStatus(actorUserId, parsed.data);
  return { data: result };
}

export async function closeReportAction(input: CloseReportInput) {
  const parsed = closeReportSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // TODO: Verifikasi role OPERATOR dari Better-Auth session
  const operatorUserId = "stub-operator-id";
  const result = await closeReport(operatorUserId, parsed.data);
  return { data: result };
}
