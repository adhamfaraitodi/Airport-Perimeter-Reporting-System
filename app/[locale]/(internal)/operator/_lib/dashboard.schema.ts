import { z } from "zod";
import type { ReportStatus } from "../../reports/_lib/reports.schema";

export const updateReportStatusSchema = z.object({
  reportId: z.string().min(1),
  nextStatus: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]),
  narrative: z
    .string()
    .min(1, "Narasi perubahan status wajib diisi")
    .max(2000, "Narasi perubahan maksimal 2.000 karakter"),
  evidencePhotoIds: z
    .array(z.string().min(1))
    .min(1, "Minimal satu foto bukti perubahan wajib disertakan"),
});

export const closeReportSchema = z.object({
  reportId: z.string().min(1),
  deletionReason: z
    .string()
    .min(1, "Alasan penutupan laporan wajib diisi")
    .max(2000, "Alasan penutupan maksimal 2.000 karakter"),
  evidencePhotoIds: z
    .array(z.string().min(1))
    .min(1, "Minimal satu foto bukti penutupan wajib disertakan"),
});

export type UpdateReportStatusInput = z.infer<typeof updateReportStatusSchema>;
export type CloseReportInput = z.infer<typeof closeReportSchema>;

export interface DashboardStatusSummary {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
}

export interface MapReportMarker {
  id: string;
  sideLocation: string;
  latitude: number;
  longitude: number;
  status: Exclude<ReportStatus, "CLOSED">;
  statusLabel: "Baru" | "Ditangani" | "Selesai";
}
