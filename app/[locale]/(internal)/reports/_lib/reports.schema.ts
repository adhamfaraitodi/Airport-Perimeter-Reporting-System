import { z } from "zod";

export const REPORT_STATUS_LABELS = {
  OPEN: "Baru",
  IN_PROGRESS: "Ditangani",
  RESOLVED: "Selesai",
  CLOSED: "Ditutup",
} as const;

export type ReportStatus = keyof typeof REPORT_STATUS_LABELS;

export const partDamageSelectionSchema = z
  .object({
    partId: z.string().min(1),
    damageIds: z.array(z.string().min(1)).min(1, "Pilih minimal satu jenis kerusakan"),
  })
  .refine(
    (val) =>
      !(
        val.damageIds.includes("berkarat_sedang") &&
        val.damageIds.includes("berkarat_berat")
      ),
    {
      message:
        "Berkarat sedang dan Berkarat berat tidak dapat dipilih bersamaan pada bagian yang sama",
    }
  );

export const createReportSchema = z.object({
  sideLocation: z.string().min(1, "Sisi lokasi wajib dipilih"),
  description: z
    .string()
    .min(1, "Narasi laporan wajib diisi")
    .max(1000, "Narasi laporan maksimal 1.000 karakter"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  initialGpsLatitude: z.number().nullable().optional(),
  initialGpsLongitude: z.number().nullable().optional(),
  gpsAccuracy: z.number().nullable().optional(),
  locationSource: z.enum(["GPS", "MANUAL"]),
  partDamages: z
    .array(partDamageSelectionSchema)
    .min(1, "Pilih minimal satu bagian perimeter"),
  photoIds: z
    .array(z.string().min(1))
    .min(1, "Minimal satu foto wajib diunggah")
    .max(8, "Maksimal 8 foto per laporan"),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

export interface ReportSummary {
  id: string;
  sideLocation: string;
  description: string;
  status: ReportStatus;
  statusLabel: (typeof REPORT_STATUS_LABELS)[ReportStatus];
  createdAt: string;
}
