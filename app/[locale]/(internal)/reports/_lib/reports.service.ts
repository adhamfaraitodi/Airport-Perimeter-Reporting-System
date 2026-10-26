import {
  REPORT_STATUS_LABELS,
  type CreateReportInput,
  type ReportStatus,
} from "./reports.schema";

export function getReportStatusLabel(status: ReportStatus, isClosed?: boolean) {
  if (isClosed || status === "CLOSED") {
    return REPORT_STATUS_LABELS.CLOSED;
  }
  return REPORT_STATUS_LABELS[status];
}

export async function createReport(userId: string, input: CreateReportInput) {
  // TODO: Simpan laporan baru ke PostgreSQL via Drizzle dengan status awal OPEN ("Baru")
  return {
    id: crypto.randomUUID(),
    userId,
    status: "OPEN" as ReportStatus,
    statusLabel: REPORT_STATUS_LABELS.OPEN,
    ...input,
  };
}
