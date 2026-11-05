import { z } from "zod";

export const initialDamageItemSchema = z.object({
  name: z.string().trim().min(1, "Nama jenis kerusakan wajib diisi.").max(100),
  exclusiveGroup: z.string().trim().optional(),
});

export const createPartSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama komponen pagar wajib diisi.")
    .max(100, "Nama komponen pagar maksimal 100 karakter."),
  damages: z.array(initialDamageItemSchema).optional(),
});

export const updatePartSchema = z.object({
  id: z.string().trim().min(1, "ID bagian tidak valid."),
  name: z
    .string()
    .trim()
    .min(1, "Nama komponen pagar wajib diisi.")
    .max(100, "Nama komponen pagar maksimal 100 karakter."),
});

export const deletePartSchema = z.object({
  partId: z.string().trim().min(1, "ID bagian tidak valid."),
});

export const reorderPartsSchema = z.object({
  orderedPartIds: z
    .array(z.string().trim().min(1))
    .min(1, "Daftar urutan komponen pagar tidak boleh kosong."),
});

export const createDamageTypeSchema = z.object({
  partId: z.string().trim().min(1, "ID bagian pagar wajib diisi."),
  name: z
    .string()
    .trim()
    .min(1, "Nama jenis kerusakan wajib diisi.")
    .max(100, "Nama jenis kerusakan maksimal 100 karakter."),
  exclusiveGroup: z.string().trim().optional(),
});

export const updateDamageTypeSchema = z.object({
  partId: z.string().trim().min(1, "ID bagian pagar wajib diisi."),
  id: z.string().trim().min(1, "ID jenis kerusakan wajib diisi."),
  name: z
    .string()
    .trim()
    .min(1, "Nama jenis kerusakan wajib diisi.")
    .max(100, "Nama jenis kerusakan maksimal 100 karakter."),
  exclusiveGroup: z.string().trim().optional(),
});

export const deleteDamageTypeSchema = z.object({
  partId: z.string().trim().min(1, "ID bagian pagar wajib diisi."),
  id: z.string().trim().min(1, "ID jenis kerusakan wajib diisi."),
});

export type CreatePartSchemaInput = z.infer<typeof createPartSchema>;
export type UpdatePartSchemaInput = z.infer<typeof updatePartSchema>;
export type CreateDamageTypeSchemaInput = z.infer<typeof createDamageTypeSchema>;
export type UpdateDamageTypeSchemaInput = z.infer<typeof updateDamageTypeSchema>;
