import { create } from "zustand";
import { persist } from "zustand/middleware";
import initialCatalog from "../_data/damage-catalog.json";
import type { DamageItem } from "./client-api";

export interface CatalogPart {
  id: string;
  name: string;
  damages: DamageItem[];
}

export function slugifyCatalogId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const defaultParts: CatalogPart[] = (initialCatalog as CatalogPart[]).map(
  (part) => ({
    id: part.id,
    name: part.name,
    damages: part.damages.map((d) => ({ ...d })),
  })
);

interface DamageCatalogState {
  parts: CatalogPart[];
  addPart: (input: { name: string; damages?: DamageItem[] }) => CatalogPart;
  updatePart: (
    partId: string,
    patch: { name: string; damages?: DamageItem[] }
  ) => void;
  deletePart: (partId: string) => void;
  addDamage: (
    partId: string,
    damage: { name: string; exclusiveGroup?: string }
  ) => DamageItem;
  updateDamage: (
    partId: string,
    damageId: string,
    patch: { name: string; exclusiveGroup?: string }
  ) => void;
  deleteDamage: (partId: string, damageId: string) => void;
  resetToDefault: () => void;
}

export const useDamageCatalog = create<DamageCatalogState>()(
  persist(
    (set, get) => ({
      parts: defaultParts,

      addPart: ({ name, damages = [] }) => {
        const trimmed = name.trim();
        if (!trimmed) {
          throw new Error("Nama bagian pagar wajib diisi.");
        }
        const existing = get().parts;
        const baseId = slugifyCatalogId(trimmed) || `bagian-${Date.now()}`;
        let id = baseId;
        let counter = 2;
        while (existing.some((p) => p.id === id)) {
          id = `${baseId}-${counter++}`;
        }
        const newPart: CatalogPart = {
          id,
          name: trimmed,
          damages: damages.map((d) => ({
            id: d.id || slugifyCatalogId(d.name),
            name: d.name.trim(),
            ...(d.exclusiveGroup?.trim()
              ? { exclusiveGroup: d.exclusiveGroup.trim() }
              : {}),
          })),
        };
        set({ parts: [...existing, newPart] });
        return newPart;
      },

      updatePart: (partId, { name, damages }) => {
        const trimmed = name.trim();
        if (!trimmed) {
          throw new Error("Nama bagian pagar wajib diisi.");
        }
        set((state) => ({
          parts: state.parts.map((part) =>
            part.id === partId
              ? {
                  ...part,
                  name: trimmed,
                  damages: damages ? damages.map((d) => ({ ...d })) : part.damages,
                }
              : part
          ),
        }));
      },

      deletePart: (partId) => {
        set((state) => ({
          parts: state.parts.filter((part) => part.id !== partId),
        }));
      },

      addDamage: (partId, { name, exclusiveGroup }) => {
        const trimmed = name.trim();
        if (!trimmed) {
          throw new Error("Nama jenis kerusakan wajib diisi.");
        }
        const part = get().parts.find((p) => p.id === partId);
        if (!part) {
          throw new Error("Bagian pagar tidak ditemukan.");
        }
        const baseId = slugifyCatalogId(trimmed) || `kerusakan-${Date.now()}`;
        let id = baseId;
        let counter = 2;
        while (part.damages.some((d) => d.id === id)) {
          id = `${baseId}-${counter++}`;
        }
        const newDamage: DamageItem = {
          id,
          name: trimmed,
          ...(exclusiveGroup?.trim()
            ? { exclusiveGroup: exclusiveGroup.trim() }
            : {}),
        };
        set((state) => ({
          parts: state.parts.map((p) =>
            p.id === partId
              ? { ...p, damages: [...p.damages, newDamage] }
              : p
          ),
        }));
        return newDamage;
      },

      updateDamage: (partId, damageId, { name, exclusiveGroup }) => {
        const trimmed = name.trim();
        if (!trimmed) {
          throw new Error("Nama jenis kerusakan wajib diisi.");
        }
        set((state) => ({
          parts: state.parts.map((p) =>
            p.id === partId
              ? {
                  ...p,
                  damages: p.damages.map((d) =>
                    d.id === damageId
                      ? {
                          id: d.id,
                          name: trimmed,
                          ...(exclusiveGroup?.trim()
                            ? { exclusiveGroup: exclusiveGroup.trim() }
                            : {}),
                        }
                      : d
                  ),
                }
              : p
          ),
        }));
      },

      deleteDamage: (partId, damageId) => {
        set((state) => ({
          parts: state.parts.map((p) =>
            p.id === partId
              ? {
                  ...p,
                  damages: p.damages.filter((d) => d.id !== damageId),
                }
              : p
          ),
        }));
      },

      resetToDefault: () => {
        set({
          parts: defaultParts.map((part) => ({
            ...part,
            damages: part.damages.map((d) => ({ ...d })),
          })),
        });
      },
    }),
    {
      name: "perimeter-damage-catalog-v1",
    }
  )
);
