import { z } from "zod";
import type { ReportRecord, SessionUser } from "../../../_lib/client-api";

export const TECHNICIAN_ALLOWED_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
] as const;

export type TechnicianStatus = (typeof TECHNICIAN_ALLOWED_STATUSES)[number];

export const TECHNICIAN_STATUS_LABELS: Record<TechnicianStatus, string> = {
  OPEN: "Baru (Perlu Ditangani)",
  IN_PROGRESS: "Sedang Dikerjakan",
  RESOLVED: "Selesai Diperbaiki",
};

export const technicianStatusSchema = z.enum(TECHNICIAN_ALLOWED_STATUSES);

export const uploadedPhotoSchema = z.object({
  id: z.string().min(1, "ID foto wajib disertakan"),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"], {
    message: "Format foto harus JPG, PNG, atau WebP.",
  }),
  base64: z.string().min(1, "Data foto tidak boleh kosong."),
});

export const updateTechnicianStatusSchema = z.object({
  reportId: z.string().uuid("ID laporan harus berupa UUID valid"),
  expectedStatus: technicianStatusSchema.optional(),
  nextStatus: technicianStatusSchema,
  narrative: z
    .string()
    .trim()
    .min(1, "Narasi perbaikan wajib diisi.")
    .max(2000, "Narasi perbaikan maksimal 2.000 karakter."),
  photos: z
    .array(uploadedPhotoSchema)
    .min(1, "Minimal sertakan 1 foto bukti penanganan lapangan.")
    .max(8, "Maksimal 8 foto bukti penanganan per pembaruan status."),
});

export type UpdateTechnicianStatusInput = z.infer<
  typeof updateTechnicianStatusSchema
>;

export interface TechnicianTaskSummary {
  totalActive: number;
  open: number;
  inProgress: number;
  resolved: number;
}

export interface TechnicianDashboardData {
  summary: TechnicianTaskSummary;
  reports: ReportRecord[];
  currentUser: SessionUser;
}
