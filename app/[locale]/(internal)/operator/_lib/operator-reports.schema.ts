import { z } from "zod";

export const findingDamageSchema = z.object({
  id: z.string().min(1, "ID kerusakan tidak boleh kosong."),
  name: z.string().min(1, "Nama kerusakan tidak boleh kosong."),
});

export const findingItemSchema = z.object({
  partId: z.string().min(1, "ID bagian pagar tidak boleh kosong."),
  partName: z.string().min(1, "Nama bagian pagar tidak boleh kosong."),
  damages: z.array(findingDamageSchema),
});

export const gpsPointSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().nonnegative(),
});

// Max ~5MB binary image in base64 (~7,000,000 characters)
const MAX_BASE64_PHOTO_LENGTH = 7 * 1024 * 1024;

export const uploadedFileSchema = z.object({
  id: z.string().min(1, "ID file tidak boleh kosong.").max(128, "ID file terlalu panjang."),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"], {
    message: "Format foto tidak didukung. Hanya JPEG, PNG, dan WebP.",
  }),
  base64: z
    .string()
    .min(1, "Data foto tidak boleh kosong.")
    .max(MAX_BASE64_PHOTO_LENGTH, "Ukuran data foto maksimal 5MB."),
});

export const beginSubmissionPayloadSchema = z
  .object({
    id: z.string().min(1, "ID transaksi wajib diisi."),
    action: z.enum(["CREATE", "STATUS", "DELETE"], {
      message: "Tindakan tidak dikenal.",
    }),
    reportId: z.string().optional(),
    expectedStatus: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
    status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
    side: z.string().optional(),
    segmentCode: z.string().optional(),
    findings: z.array(findingItemSchema).optional(),
    narrative: z
      .string()
      .trim()
      .min(1, "Narasi wajib diisi.")
      .max(2000, "Narasi maksimal 2.000 karakter."),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    gps: gpsPointSchema.nullable().optional(),
    locationSource: z.enum(["GPS", "MANUAL"]).optional(),
    expectedImageIds: z.array(z.string()).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.action === "CREATE") {
      if (typeof data.latitude !== "number" || typeof data.longitude !== "number") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Titik koordinat latitude dan longitude wajib diisi.",
          path: ["latitude"],
        });
      }
    } else {
      if (!data.reportId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ID laporan wajib disertakan.",
          path: ["reportId"],
        });
      }
      if (data.action === "STATUS" && !data.status) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Status baru wajib dipilih.",
          path: ["status"],
        });
      }
    }
  });

export const commitReportSubmissionInputSchema = z.object({
  payload: beginSubmissionPayloadSchema,
  files: z.array(uploadedFileSchema).max(10, "Maksimal 10 foto per pengiriman."),
});

export type FindingDamage = z.infer<typeof findingDamageSchema>;
export type FindingItem = z.infer<typeof findingItemSchema>;
export type GpsPoint = z.infer<typeof gpsPointSchema>;
export type UploadedFilePayload = z.infer<typeof uploadedFileSchema>;
export type BeginSubmissionPayload = z.infer<typeof beginSubmissionPayloadSchema>;
export type CommitReportSubmissionInput = z.infer<typeof commitReportSubmissionInputSchema>;
