import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface DraftEntry {
  narrative?: string;
  side?: string;
  segmentCode?: string;
  selection?: Record<string, string[]>;
}

interface DraftsState {
  drafts: Record<string, DraftEntry>;
  update: (key: string, patch: Partial<DraftEntry>) => void;
  clear: (key: string) => void;
}

export const useDrafts = create<DraftsState>()(
  persist(
    (set) => ({
      drafts: {},
      update: (key, patch) =>
        set((state) => ({
          drafts: {
            ...state.drafts,
            [key]: { ...state.drafts[key], ...patch },
          },
        })),
      clear: (key) =>
        set((state) => {
          const drafts = { ...state.drafts };
          delete drafts[key];
          return { drafts };
        }),
    }),
    {
      name: "perimeter-text-drafts-v1",
      partialize: (state) => ({ drafts: state.drafts }),
    }
  )
);

export const labels: Record<string, string> = {
  OPEN: "Baru",
  IN_PROGRESS: "Ditangani",
  RESOLVED: "Selesai",
  CLOSED: "Ditutup",
};

export const countText = (text: string): number => Array.from(text || "").length;

export const dateText = (value?: string | null): string =>
  value && !Number.isNaN(new Date(value).getTime())
    ? new Date(value).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "Waktu tidak tersedia";

export const message = (err: unknown): string =>
  err instanceof Error && err.message ? err.message : "Terjadi kesalahan.";

export const newId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "sub-" + Math.random().toString(36).slice(2, 10);
