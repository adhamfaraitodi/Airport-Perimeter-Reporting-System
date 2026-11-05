import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama lengkap tidak boleh kosong.")
    .max(100, "Nama lengkap maksimal 100 karakter."),
  phone: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine(
      (val) => !val || (val.length >= 10 && val.length <= 15 && /^\d+$/.test(val)),
      "Nomor telepon harus berupa angka antara 10 sampai 15 digit."
    ),
  avatarDataUrl: z.string().nullable().optional(),
  signatureDataUrl: z.string().nullable().optional(),
});

export type UpdateProfileSchemaInput = z.infer<typeof updateProfileSchema>;
