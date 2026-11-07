import { z } from "zod";

const MAX_BASE64_IMAGE_LENGTH = 5 * 1024 * 1024;

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
  avatarDataUrl: z
    .string()
    .max(MAX_BASE64_IMAGE_LENGTH, "Ukuran foto profil maksimal 3.5MB.")
    .nullable()
    .optional(),
  signatureDataUrl: z
    .string()
    .max(MAX_BASE64_IMAGE_LENGTH, "Ukuran tanda tangan maksimal 3.5MB.")
    .nullable()
    .optional(),
});

export type UpdateProfileSchemaInput = z.infer<typeof updateProfileSchema>;
