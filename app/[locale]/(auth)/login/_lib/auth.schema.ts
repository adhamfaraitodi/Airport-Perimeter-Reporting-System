import { z } from "zod";

export const userRoleSchema = z.enum(["REPORTER", "OPERATOR", "TECHNICIAN"]);
export const accountStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const loginSchema = z.object({
  nip: z
    .string()
    .trim()
    .min(3, "NIP minimal 3 digit angka.")
    .max(30, "NIP maksimal 30 digit angka.")
    .regex(
      /^[0-9]+$/,
      "NIP hanya boleh berisi angka (termasuk angka nol di depan)."
    ),
  password: z
    .string()
    .min(1, "Password wajib diisi.")
    .max(128, "Password terlalu panjang."),
  rememberMe: z.boolean().optional().default(true),
  locale: z.string().optional().default("id"),
});

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama lengkap minimal 2 karakter.")
    .max(100, "Nama lengkap maksimal 100 karakter."),
  phone: z
    .string()
    .trim()
    .min(8, "Nomor kontak telepon minimal 8 karakter.")
    .max(25, "Nomor kontak telepon maksimal 25 karakter.")
    .regex(
      /^[0-9+\-\s()]+$/,
      "Nomor kontak hanya boleh berisi angka, spasi, +, atau tanda hubung (-)."
    ),
  avatarUrl: z.string().nullable().optional(),
});

export const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(6, "Password baru minimal 6 karakter.")
      .max(128, "Password maksimal 128 karakter."),
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
