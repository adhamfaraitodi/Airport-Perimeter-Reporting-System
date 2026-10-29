import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserRole } from "./client-api";

export type AccountStatus = "ACTIVE" | "INACTIVE";

export interface ManagedAccount {
  id: string;
  nip: string;
  name: string;
  email: string;
  role: UserRole;
  unit: string;
  status: AccountStatus;
  createdAt: string;
}

export const roleLabels: Record<UserRole, string> = {
  OPERATOR: "Operator Perimeter",
  REPORTER: "Pelapor Lapangan",
  TECHNICIAN: "Teknisi",
};

const defaultAccounts: ManagedAccount[] = [
  {
    id: "demo-operator",
    nip: "19900314201601",
    name: "Operator Demo",
    email: "operator@injourneyairports.id",
    role: "OPERATOR",
    unit: "Airport Operation Control Center (AOCC)",
    status: "ACTIVE",
    createdAt: "2026-01-10T08:00:00.000Z",
  },
  {
    id: "demo-reporter",
    nip: "19940721201902",
    name: "Petugas Demo",
    email: "reporter@injourneyairports.id",
    role: "REPORTER",
    unit: "Airport Security (AVSEC)",
    status: "ACTIVE",
    createdAt: "2026-01-12T09:15:00.000Z",
  },
  {
    id: "demo-technician",
    nip: "19921105201803",
    name: "Teknisi Demo",
    email: "technician@injourneyairports.id",
    role: "TECHNICIAN",
    unit: "Airport Maintenance & Civil",
    status: "ACTIVE",
    createdAt: "2026-01-15T10:30:00.000Z",
  },
  {
    id: "usr-avsec-02",
    nip: "19960218202101",
    name: "Budi Santoso",
    email: "budi.santoso@injourneyairports.id",
    role: "REPORTER",
    unit: "Airport Security (AVSEC)",
    status: "ACTIVE",
    createdAt: "2026-02-03T07:45:00.000Z",
  },
  {
    id: "usr-avsec-03",
    nip: "19970809202204",
    name: "Rina Wulandari",
    email: "rina.wulandari@injourneyairports.id",
    role: "REPORTER",
    unit: "Patroli Perimeter & Airside",
    status: "ACTIVE",
    createdAt: "2026-02-18T13:20:00.000Z",
  },
  {
    id: "usr-tech-02",
    nip: "19930529201905",
    name: "Hendra Wijaya",
    email: "hendra.wijaya@injourneyairports.id",
    role: "TECHNICIAN",
    unit: "Airport Maintenance & Civil",
    status: "INACTIVE",
    createdAt: "2026-03-01T11:00:00.000Z",
  },
];

export interface AccountInput {
  nip: string;
  name: string;
  email?: string;
  role: UserRole;
  unit: string;
  status: AccountStatus;
}

interface AccountsState {
  accounts: ManagedAccount[];
  addAccount: (input: AccountInput) => ManagedAccount;
  updateAccount: (id: string, patch: AccountInput) => void;
  toggleAccountStatus: (id: string) => void;
  deleteAccount: (id: string) => void;
  resetToDefault: () => void;
}

export const useAccountsStore = create<AccountsState>()(
  persist(
    (set, get) => ({
      accounts: defaultAccounts,

      addAccount: (input) => {
        const nip = input.nip.trim();
        const name = input.name.trim();
        const email =
          (input.email || "").trim().toLowerCase() ||
          `${nip.toLowerCase()}@injourneyairports.id`;
        const unit = input.unit.trim() || "Operasional Bandara";

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
          role: input.role,
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
                  role: patch.role,
                  unit,
                  status: patch.status,
                }
              : account
          ),
        });
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
          accounts: defaultAccounts.map((account) => ({ ...account })),
        });
      },
    }),
    {
      name: "perimeter-accounts-master-v1",
    }
  )
);
