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
  // TODO: Simpan perubahan status + riwayat + foto bukti ke PostgreSQL via Drizzle
  return {
    reportId: input.reportId,
    updatedBy: actorUserId,
    status: input.nextStatus,
    statusLabel: REPORT_STATUS_LABELS[input.nextStatus],
  };
}

export async function closeReport(
  operatorUserId: string,
  input: CloseReportInput
) {
  // TODO: Soft delete laporan (status tampilan CLOSED / "Ditutup") dengan alasan + foto bukti wajib
  return {
    reportId: input.reportId,
    deletedBy: operatorUserId,
    status: "CLOSED" as ReportStatus,
    statusLabel: REPORT_STATUS_LABELS.CLOSED,
  };
}
