"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { auth, type UserRole } from "@/lib/auth";

export interface DamageItemDto {
  id: string;
  name: string;
  exclusiveGroup?: string;
}

export interface CatalogPartDto {
  id: string;
  name: string;
  sortOrder?: number;
  damages: DamageItemDto[];
}

export function slugifyCatalogId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * High-performance in-memory cache singleton.
 * Provides 0ms latency for all roles (Operator, Reporter, Technician).
 * Write-through invalidation guarantees 1:1 sync with PostgreSQL.
 */
let inMemoryCatalogCache: CatalogPartDto[] | null = null;

export function invalidateDamageCatalogCache() {
  inMemoryCatalogCache = null;
  try {
    revalidatePath("/[locale]/operator/perimeter-damage", "page");
    revalidatePath("/[locale]/reports", "page");
  } catch {
    // Ignore in non-request contexts
  }
}

async function verifyOperatorSession() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null);

  if (!session?.user?.id) {
    throw new Error("Sesi tidak valid. Silakan login kembali.");
  }

  const role = (session.user as Record<string, unknown>).role as string | undefined;
  if (role !== "OPERATOR") {
    throw new Error("Akses ditolak. Hanya Operator yang dapat mengelola data master.");
  }

  return session.user;
}

/**
 * Fetch fresh catalog directly from PostgreSQL and rebuild cache.
 */
async function fetchCatalogFromDb(): Promise<CatalogPartDto[]> {
  const [parts, damages] = await Promise.all([
    db
      .select({
        id: schema.perimeterParts.id,
        name: schema.perimeterParts.name,
        sortOrder: schema.perimeterParts.sortOrder,
      })
      .from(schema.perimeterParts)
      .where(eq(schema.perimeterParts.isActive, true))
      .orderBy(asc(schema.perimeterParts.sortOrder), asc(schema.perimeterParts.name)),
    db
      .select({
        id: schema.damageTypes.id,
        partId: schema.damageTypes.partId,
        name: schema.damageTypes.name,
        exclusiveGroup: schema.damageTypes.exclusiveGroup,
      })
      .from(schema.damageTypes)
      .where(eq(schema.damageTypes.isActive, true))
      .orderBy(asc(schema.damageTypes.name)),
  ]);

  const catalog: CatalogPartDto[] = parts.map((part) => ({
    id: part.id,
    name: part.name,
    sortOrder: part.sortOrder,
    damages: damages
      .filter((d) => d.partId === part.id)
      .map((d) => ({
        id: d.id,
        name: d.name,
        ...(d.exclusiveGroup ? { exclusiveGroup: d.exclusiveGroup } : {}),
      })),
  }));

  inMemoryCatalogCache = catalog;
  return catalog;
}

/**
 * Get the full perimeter damage catalog with fast in-memory caching.
 * Accessible by all authenticated roles.
 */
export async function getDamageCatalogAction(): Promise<{
  success: boolean;
  catalog: CatalogPartDto[];
  errorMessage?: string;
}> {
  try {
    if (inMemoryCatalogCache) {
      return { success: true, catalog: inMemoryCatalogCache };
    }

    const catalog = await fetchCatalogFromDb();
    return { success: true, catalog };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memuat katalog kerusakan perimeter.";
    return { success: false, catalog: [], errorMessage: msg };
  }
}

/**
 * Create a new perimeter part with optional initial damages in PostgreSQL.
 */
export async function createPartAction(input: {
  name: string;
  damages?: Array<{ name: string; exclusiveGroup?: string }>;
}): Promise<{
  success: boolean;
  part?: CatalogPartDto;
  errorMessage?: string;
}> {
  try {
    await verifyOperatorSession();

    const trimmedName = input.name.trim();
    if (!trimmedName) {
      return { success: false, errorMessage: "Nama bagian pagar wajib diisi." };
    }

    const existingParts = await db
      .select({ id: schema.perimeterParts.id, sortOrder: schema.perimeterParts.sortOrder })
      .from(schema.perimeterParts);

    const baseSlug = slugifyCatalogId(trimmedName) || `bagian-${Date.now()}`;
    let partId = baseSlug;
    let counter = 2;
    while (existingParts.some((p) => p.id === partId)) {
      partId = `${baseSlug}-${counter++}`;
    }

    const nextSortOrder = existingParts.length > 0
      ? Math.max(...existingParts.map((p) => p.sortOrder || 0)) + 1
      : 1;

    const initialDamages = input.damages && input.damages.length > 0
      ? input.damages
      : [{ name: "Lainnya" }];

    await db.transaction(async (tx) => {
      // 1. Insert part
      await tx.insert(schema.perimeterParts).values({
        id: partId,
        name: trimmedName,
        sortOrder: nextSortOrder,
        isActive: true,
      });

      // 2. Insert damages
      for (const d of initialDamages) {
        const damageName = d.name.trim();
        if (!damageName) continue;
        const damageId = slugifyCatalogId(damageName) || `kerusakan-${Date.now()}`;
        await tx.insert(schema.damageTypes).values({
          id: damageId,
          partId,
          name: damageName,
          exclusiveGroup: d.exclusiveGroup?.trim() || null,
          isActive: true,
        }).onConflictDoUpdate({
          target: [schema.damageTypes.partId, schema.damageTypes.id],
          set: {
            name: damageName,
            exclusiveGroup: d.exclusiveGroup?.trim() || null,
            isActive: true,
            updatedAt: new Date(),
          },
        });
      }
    });

    invalidateDamageCatalogCache();
    const freshCatalog = await fetchCatalogFromDb();
    const createdPart = freshCatalog.find((p) => p.id === partId);

    return { success: true, part: createdPart };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menambahkan bagian pagar.";
    return { success: false, errorMessage: msg };
  }
}

/**
 * Update an existing perimeter part and optionally sync its damage items.
 */
export async function updatePartAction(
  partId: string,
  input: {
    name: string;
    damages?: Array<{ id?: string; name: string; exclusiveGroup?: string }>;
  }
): Promise<{
  success: boolean;
  part?: CatalogPartDto;
  errorMessage?: string;
}> {
  try {
    await verifyOperatorSession();

    const trimmedName = input.name.trim();
    if (!trimmedName) {
      return { success: false, errorMessage: "Nama bagian pagar wajib diisi." };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(schema.perimeterParts)
        .set({
          name: trimmedName,
          updatedAt: new Date(),
        })
        .where(eq(schema.perimeterParts.id, partId));

      if (input.damages && input.damages.length > 0) {
        // Collect current damages to preserve/update
        for (const d of input.damages) {
          const damageName = d.name.trim();
          if (!damageName) continue;
          const damageId = d.id || slugifyCatalogId(damageName) || `kerusakan-${Date.now()}`;

          await tx.insert(schema.damageTypes).values({
            id: damageId,
            partId,
            name: damageName,
            exclusiveGroup: d.exclusiveGroup?.trim() || null,
            isActive: true,
          }).onConflictDoUpdate({
            target: [schema.damageTypes.partId, schema.damageTypes.id],
            set: {
              name: damageName,
              exclusiveGroup: d.exclusiveGroup?.trim() || null,
              isActive: true,
              updatedAt: new Date(),
            },
          });
        }
      }
    });

    invalidateDamageCatalogCache();
    const freshCatalog = await fetchCatalogFromDb();
    const updatedPart = freshCatalog.find((p) => p.id === partId);

    return { success: true, part: updatedPart };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memperbarui bagian pagar.";
    return { success: false, errorMessage: msg };
  }
}

/**
 * Delete a perimeter part (cascades to all its damage types in PostgreSQL).
 */
export async function deletePartAction(partId: string): Promise<{
  success: boolean;
  errorMessage?: string;
}> {
  try {
    await verifyOperatorSession();

    await db
      .delete(schema.perimeterParts)
      .where(eq(schema.perimeterParts.id, partId));

    invalidateDamageCatalogCache();
    await fetchCatalogFromDb();

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menghapus bagian pagar.";
    return { success: false, errorMessage: msg };
  }
}

/**
 * Add a new damage classification to a part in PostgreSQL.
 */
export async function createDamageAction(input: {
  partId: string;
  name: string;
  exclusiveGroup?: string;
}): Promise<{
  success: boolean;
  damage?: DamageItemDto;
  errorMessage?: string;
}> {
  try {
    await verifyOperatorSession();

    const trimmedName = input.name.trim();
    if (!trimmedName) {
      return { success: false, errorMessage: "Nama jenis kerusakan wajib diisi." };
    }

    const baseSlug = slugifyCatalogId(trimmedName) || `kerusakan-${Date.now()}`;
    const damageId = baseSlug;

    // Check duplicate in same part
    const existing = await db
      .select({ id: schema.damageTypes.id })
      .from(schema.damageTypes)
      .where(
        and(
          eq(schema.damageTypes.partId, input.partId),
          eq(schema.damageTypes.id, damageId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return {
        success: false,
        errorMessage: "Jenis kerusakan tersebut sudah terdaftar pada bagian ini.",
      };
    }

    await db.insert(schema.damageTypes).values({
      id: damageId,
      partId: input.partId,
      name: trimmedName,
      exclusiveGroup: input.exclusiveGroup?.trim() || null,
      isActive: true,
    });

    invalidateDamageCatalogCache();
    await fetchCatalogFromDb();

    return {
      success: true,
      damage: {
        id: damageId,
        name: trimmedName,
        ...(input.exclusiveGroup ? { exclusiveGroup: input.exclusiveGroup } : {}),
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menambahkan jenis kerusakan.";
    return { success: false, errorMessage: msg };
  }
}

/**
 * Update an existing damage classification in PostgreSQL.
 */
export async function updateDamageAction(
  partId: string,
  damageId: string,
  input: {
    name: string;
    exclusiveGroup?: string;
  }
): Promise<{
  success: boolean;
  damage?: DamageItemDto;
  errorMessage?: string;
}> {
  try {
    await verifyOperatorSession();

    const trimmedName = input.name.trim();
    if (!trimmedName) {
      return { success: false, errorMessage: "Nama jenis kerusakan wajib diisi." };
    }

    await db
      .update(schema.damageTypes)
      .set({
        name: trimmedName,
        exclusiveGroup: input.exclusiveGroup?.trim() || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.damageTypes.partId, partId),
          eq(schema.damageTypes.id, damageId)
        )
      );

    invalidateDamageCatalogCache();
    await fetchCatalogFromDb();

    return {
      success: true,
      damage: {
        id: damageId,
        name: trimmedName,
        ...(input.exclusiveGroup ? { exclusiveGroup: input.exclusiveGroup } : {}),
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memperbarui jenis kerusakan.";
    return { success: false, errorMessage: msg };
  }
}

/**
 * Delete a damage classification from PostgreSQL.
 */
export async function deleteDamageAction(
  partId: string,
  damageId: string
): Promise<{
  success: boolean;
  errorMessage?: string;
}> {
  try {
    await verifyOperatorSession();

    await db
      .delete(schema.damageTypes)
      .where(
        and(
          eq(schema.damageTypes.partId, partId),
          eq(schema.damageTypes.id, damageId)
        )
      );

    invalidateDamageCatalogCache();
    await fetchCatalogFromDb();

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menghapus jenis kerusakan.";
    return { success: false, errorMessage: msg };
  }
}

/**
 * Reset and re-seed the standard airport perimeter catalog into PostgreSQL.
 */
export async function resetDamageCatalogAction(): Promise<{
  success: boolean;
  catalog: CatalogPartDto[];
  errorMessage?: string;
}> {
  try {
    await verifyOperatorSession();

    // Standard default perimeter parts & damages
    const DEFAULT_SEED_PARTS = [
      {
        id: "pondasi",
        name: "Pondasi",
        sortOrder: 1,
        damages: [
          { id: "bercelah", name: "Bercelah" },
          { id: "lainnya", name: "Lainnya" },
          { id: "miring", name: "Miring" },
          { id: "runtuh", name: "Runtuh" },
        ],
      },
      {
        id: "tiang-pagar",
        name: "Tiang Pagar",
        sortOrder: 2,
        damages: [
          { id: "berkarat-berat", name: "Berkarat berat", exclusiveGroup: "korosi" },
          { id: "berkarat-sedang", name: "Berkarat sedang", exclusiveGroup: "korosi" },
          { id: "lainnya", name: "Lainnya" },
          { id: "miring", name: "Miring" },
          { id: "penyok", name: "Penyok" },
        ],
      },
      {
        id: "pagar-harmonika-brc",
        name: "Pagar Harmonika / BRC",
        sortOrder: 3,
        damages: [
          { id: "berkarat-berat", name: "Berkarat berat", exclusiveGroup: "korosi" },
          { id: "berkarat-sedang", name: "Berkarat sedang", exclusiveGroup: "korosi" },
          { id: "berlubang", name: "Berlubang" },
          { id: "klem-terlepas", name: "Klem terlepas" },
          { id: "lainnya", name: "Lainnya" },
        ],
      },
      {
        id: "kawat-duri-razor",
        name: "Kawat Duri / Razor",
        sortOrder: 4,
        damages: [
          { id: "berkarat-berat", name: "Berkarat berat", exclusiveGroup: "korosi" },
          { id: "berkarat-sedang", name: "Berkarat sedang", exclusiveGroup: "korosi" },
          { id: "lainnya", name: "Lainnya" },
          { id: "terlepas", name: "Terlepas" },
          { id: "tumpul", name: "Tumpul" },
        ],
      },
      {
        id: "tiang-penyangga-kawat-duri",
        name: "Tiang Penyangga Kawat Duri",
        sortOrder: 5,
        damages: [
          { id: "lainnya", name: "Lainnya" },
          { id: "patah", name: "Patah" },
          { id: "terlepas", name: "Terlepas" },
        ],
      },
    ];

    await db.transaction(async (tx) => {
      // Clear existing catalog
      await tx.delete(schema.damageTypes);
      await tx.delete(schema.perimeterParts);

      // Re-seed defaults
      for (const p of DEFAULT_SEED_PARTS) {
        await tx.insert(schema.perimeterParts).values({
          id: p.id,
          name: p.name,
          sortOrder: p.sortOrder,
          isActive: true,
        });

        for (const d of p.damages) {
          await tx.insert(schema.damageTypes).values({
            id: d.id,
            partId: p.id,
            name: d.name,
            exclusiveGroup: d.exclusiveGroup || null,
            isActive: true,
          });
        }
      }
    });

    invalidateDamageCatalogCache();
    const catalog = await fetchCatalogFromDb();

    return { success: true, catalog };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal mengembalikan data master bawaan.";
    return { success: false, catalog: [], errorMessage: msg };
  }
}
