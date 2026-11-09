import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserRole } from "./client-api";

export type AccountStatus = "ACTIVE" | "INACTIVE";

export interface ManagedAccount {
  id: string;
  nip: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string | null;
  role: UserRole;
  position?: string | null;
  unit: string;
  status: AccountStatus;
  createdAt: string;
}

export const roleLabels: Record<UserRole, string> = {
  OPERATOR: "Operator Perimeter",
  REPORTER: "Pelapor Lapangan",
  TECHNICIAN: "Teknisi Pemeliharaan",
};

const defaultAccounts: ManagedAccount[] = [];

const defaultPhoneById = new Map<string, string>();

export interface AccountInput {
  nip: string;
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string | null;
  role: UserRole;
  position?: string | null;
  unit: string;
  status: AccountStatus;
}

export interface ProfileUpdateInput {
  name: string;
  phone: string;
  avatarUrl?: string | null;
}

interface AccountsState {
  accounts: ManagedAccount[];
  addAccount: (input: AccountInput) => ManagedAccount;
  updateAccount: (id: string, patch: AccountInput) => void;
  updateProfile: (id: string, patch: ProfileUpdateInput) => void;
  toggleAccountStatus: (id: string) => void;
  deleteAccount: (id: string) => void;
  resetToDefault: () => void;
}

export const useAccountsStore = create<AccountsState>()(
  persist(
    (set, get) => ({
      accounts: [],

      addAccount: (input) => {
        const nip = input.nip.trim();
        const name = input.name.trim();
        const email =
          (input.email || "").trim().toLowerCase() ||
          `${nip.toLowerCase()}@injourneyairports.id`;
        const phone = (input.phone || "").trim() || "-";
        const unit = input.unit.trim() || "Operasional Bandara";
        const position = input.position?.trim() || "Officer";

        if (!nip || !name) {
          throw new Error("NIP dan nama lengkap wajib diisi.");
        }

        const current = get().accounts;
        if (current.some((a) => a.nip.toLowerCase() === nip.toLowerCase())) {
          throw new Error("NIP sudah terdaftar pada akun lain.");
        }

        const created: ManagedAccount = {
          id: `usr-${Date.now()}`,
          nip,
          name,
          email,
          phone,
          avatarUrl: input.avatarUrl ?? null,
          role: input.role,
          position,
          unit,
          status: input.status,
          createdAt: new Date().toISOString(),
        };

        set({ accounts: [created, ...current] });
        return created;
      },

      updateAccount: (id, patch) => {
        const nip = patch.nip.trim();
        const name = patch.name.trim();
        const unit = patch.unit.trim() || "Operasional Bandara";
        const position = patch.position !== undefined ? patch.position?.trim() || "Officer" : undefined;
        const phone =
          patch.phone !== undefined ? patch.phone.trim() || "-" : undefined;

        if (!nip || !name) {
          throw new Error("NIP dan nama lengkap wajib diisi.");
        }

        const current = get().accounts;
        if (
          current.some(
            (a) => a.id !== id && a.nip.toLowerCase() === nip.toLowerCase()
          )
        ) {
          throw new Error("NIP sudah terdaftar pada akun lain.");
        }

        set({
          accounts: current.map((account) =>
            account.id === id
              ? {
                  ...account,
                  nip,
                  name,
                  email: patch.email?.trim()
                    ? patch.email.trim().toLowerCase()
                    : account.email,
                  phone: phone !== undefined ? phone : account.phone || "-",
                  avatarUrl:
                    patch.avatarUrl !== undefined
                      ? patch.avatarUrl
                      : account.avatarUrl,
                  role: patch.role,
                  position: position !== undefined ? position : account.position,
                  unit,
                  status: patch.status,
                }
              : account
          ),
        });
      },

      updateProfile: (id, patch) => {
        const name = patch.name.trim();
        const phone = patch.phone.trim() || "-";

        if (!name) {
          throw new Error("Nama lengkap wajib diisi.");
        }

        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.id === id
              ? {
                  ...account,
                  name,
                  phone,
                  avatarUrl:
                    patch.avatarUrl !== undefined
                      ? patch.avatarUrl
                      : account.avatarUrl,
                }
              : account
          ),
        }));
      },

      toggleAccountStatus: (id) => {
        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.id === id
              ? {
                  ...account,
                  status: account.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                }
              : account
          ),
        }));
      },

      deleteAccount: (id) => {
        set((state) => ({
          accounts: state.accounts.filter((account) => account.id !== id),
        }));
      },

      resetToDefault: () => {
        set({
          accounts: [],
        });
      },
    }),
    {
      name: "perimeter-accounts-master-v4",
      merge: (persistedState, currentState) => {
        const typed = persistedState as Partial<AccountsState> | undefined;
        if (!typed?.accounts) return currentState;
        return {
          ...currentState,
          ...typed,
          accounts: typed.accounts.map((acc) => ({
            ...acc,
            position: acc.position || "Officer",
            phone:
              acc.phone?.trim() ||
              defaultPhoneById.get(acc.id) ||
              "0812-0000-0000",
            avatarUrl: acc.avatarUrl ?? null,
          })),
        };
      },
    }
  )
);
