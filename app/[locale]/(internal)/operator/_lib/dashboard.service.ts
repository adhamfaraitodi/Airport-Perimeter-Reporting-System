import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  REPORT_STATUS_LABELS,
  type ReportStatus,
} from "../../reports/_lib/reports.schema";
import type {
  CloseReportInput,
  UpdateReportStatusInput,
} from "./dashboard.schema";

const ALLOWED_TRANSITIONS: Record<
  Exclude<ReportStatus, "CLOSED">,
  Array<Exclude<ReportStatus, "CLOSED">>
> = {
  OPEN: ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["OPEN"],
};

export function canTransitionStatus(
  currentStatus: ReportStatus,
  nextStatus: Exclude<ReportStatus, "CLOSED">
): boolean {
  if (currentStatus === "CLOSED") {
    return false;
  }
  return ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus);
}

export async function updateReportStatus(
  actorUserId: string,
  input: UpdateReportStatusInput
) {
  const existing = await db
    .select()
    .from(schema.reports)
    .where(eq(schema.reports.id, input.reportId))
    .limit(1);

  if (existing.length === 0) {
    throw new Error("Laporan tidak ditemukan.");
  }

  const report = existing[0];
  const previousStatus = report.status;

  if (report.deletedAt || report.status === "CLOSED") {
    throw new Error("Laporan telah ditutup dan tidak dapat diubah statusnya.");
  }

  if (!canTransitionStatus(report.status, input.nextStatus)) {
    throw new Error(
      `Perubahan status dari "${report.status}" ke "${input.nextStatus}" tidak diizinkan.`
    );
  }

  const historyId = crypto.randomUUID();

  // 1. Simpan riwayat perubahan status
  await db.insert(schema.reportStatusHistory).values({
    id: historyId,
    reportId: input.reportId,
    actorId: actorUserId,
    previousStatus,
    newStatus: input.nextStatus,
    narrative: input.narrative,
    createdAt: new Date(),
  });

  // 2. Perbarui status pada tabel laporan
  await db
    .update(schema.reports)
    .set({
      status: input.nextStatus,
      updatedAt: new Date(),
    })
    .where(eq(schema.reports.id, input.reportId));

  return {
    reportId: input.reportId,
    updatedBy: actorUserId,
    status: input.nextStatus,
    statusLabel: REPORT_STATUS_LABELS[input.nextStatus],
    historyId,
  };
}

export async function closeReport(
  operatorUserId: string,
  input: CloseReportInput
) {
  const existing = await db
    .select()
    .from(schema.reports)
    .where(eq(schema.reports.id, input.reportId))
    .limit(1);

  if (existing.length === 0) {
    throw new Error("Laporan tidak ditemukan.");
  }

  const report = existing[0];
  const previousStatus = report.status;

  const historyId = crypto.randomUUID();

  // 1. Catat riwayat penutupan status
  await db.insert(schema.reportStatusHistory).values({
    id: historyId,
    reportId: input.reportId,
    actorId: operatorUserId,
    previousStatus,
    newStatus: "CLOSED",
    narrative: input.deletionReason,
    createdAt: new Date(),
  });

  // 2. Soft delete laporan (status CLOSED)
  await db
    .update(schema.reports)
    .set({
      status: "CLOSED",
      deletedAt: new Date(),
      deletedBy: operatorUserId,
      deletionReason: input.deletionReason,
      updatedAt: new Date(),
    })
    .where(eq(schema.reports.id, input.reportId));

  return {
    reportId: input.reportId,
    deletedBy: operatorUserId,
    status: "CLOSED" as ReportStatus,
    statusLabel: REPORT_STATUS_LABELS.CLOSED,
    historyId,
  };
}
