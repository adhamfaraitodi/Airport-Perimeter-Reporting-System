import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface DraftEntry {
  narrative?: string;
  side?: string;
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
  value
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(new Date(value)) + " WIB"
    : "—";

export const newId = (): string => crypto.randomUUID();

export const message = (error: unknown): string =>
  error instanceof Error && error.message
    ? error.message
    : "Permintaan gagal. Periksa koneksi lalu coba lagi.";
