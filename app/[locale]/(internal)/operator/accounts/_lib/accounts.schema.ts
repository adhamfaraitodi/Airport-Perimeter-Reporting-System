import { z } from "zod";
import { USER_POSITIONS } from "@/db/schema";

export const userRoleEnum = z.enum(["REPORTER", "OPERATOR", "TECHNICIAN"], {
  message: "Role harus salah satu dari REPORTER, OPERATOR, atau TECHNICIAN.",
});

export const accountStatusEnum = z.enum(["ACTIVE", "INACTIVE"], {
  message: "Status akun harus ACTIVE atau INACTIVE.",
});

export const userPositionEnum = z.enum(USER_POSITIONS, {
  message: "Posisi harus salah satu dari: Officer, Chief, Chief Assistant, Departement Head, Supervisor.",
});

export const createAccountSchema = z.object({
  nip: z
  .string()
  .trim()
  .min(3, "NIP minimal 3 karakter.")
  .max(30, "NIP maksimal 30 karakter.")
  .regex(/^[0-9]+$/, "NIP hanya boleh berisi angka tanpa spasi."),
  name: z
  .string()
  .trim()
  .min(1, "Nama lengkap wajib diisi.")
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
  unit: z
  .string()
  .trim()
  .min(1, "Unit kerja wajib diisi.")
  .max(100, "Unit kerja maksimal 100 karakter.")
  .default("Operasional Bandara"),
  role: userRoleEnum,
  position: userPositionEnum.default("Officer").optional().nullable(),
  status: accountStatusEnum.default("ACTIVE"),
  password: z
  .string()
  .trim()
  .min(8, "Password minimal 8 karakter.")
  .max(100, "Password maksimal 100 karakter."),
  avatarUrl: z.string().nullable().optional(),
});

export const updateAccountSchema = z.object({
  id: z.string().uuid("ID akun tidak valid."),
  nip: z
  .string()
  .trim()
  .min(3, "NIP minimal 3 karakter.")
  .max(30, "NIP maksimal 30 karakter.")
  .regex(/^[0-9]+$/, "NIP hanya boleh berisi angka tanpa spasi."),
  name: z
  .string()
  .trim()
  .min(1, "Nama lengkap wajib diisi.")
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
  unit: z
  .string()
  .trim()
  .min(1, "Unit kerja wajib diisi.")
  .max(100, "Unit kerja maksimal 100 karakter.")
  .default("Operasional Bandara"),
  role: userRoleEnum,
  position: userPositionEnum.default("Officer").optional().nullable(),
  status: accountStatusEnum,
  avatarUrl: z.string().nullable().optional(),
});

export const toggleAccountStatusSchema = z.object({
  id: z.string().uuid("ID akun tidak valid."),
  newStatus: accountStatusEnum,
});

export const resetPasswordSchema = z.object({
  id: z.string().uuid("ID akun tidak valid."),
  newPassword: z
  .string()
  .trim()
  .min(8, "Password baru minimal 8 karakter.")
  .max(100, "Password baru maksimal 100 karakter."),
});

export const deleteAccountSchema = z.object({
  id: z.string().uuid("ID akun tidak valid."),
});

export type CreateAccountSchemaInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountSchemaInput = z.infer<typeof updateAccountSchema>;
