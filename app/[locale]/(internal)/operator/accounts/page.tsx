"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Pencil,
  Phone,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  api,
  type SessionUser,
  type UserRole,
} from "../../../_lib/client-api";
import {
  roleLabels,
  type AccountStatus,
  type ManagedAccount,
} from "../../../_lib/accounts-store";
import {
  getAccountsAction,
  createAccountAction,
  updateAccountAction,
  toggleAccountStatusAction,
  resetAccountPasswordAction,
  deleteAccountAction,
} from "./_lib/accounts.actions";
import { dateText, message } from "../../../_lib/draft-store";
import {
  btnBase,
  btnCancelCoral,
  btnCloseCoral,
  btnDanger,
  btnIcon,
  btnPrimary,
  fieldControl,
  fieldLabel,
  focusRing,
} from "../../../_lib/ui-classes";
import { useTheme } from "../../../_lib/use-theme";
import { AppHeader } from "../../../_components/app-header";
import { DashboardFooter } from "../_components/dashboard-footer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";

type RoleFilter = "ALL" | UserRole;
type StatusFilter = "ALL" | AccountStatus;

interface AccountModalState {
  mode: "CREATE" | "EDIT";
  accountId?: string;
  nip: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  unit: string;
  status: AccountStatus;
  password: string;
}

interface PasswordModalState {
  account: ManagedAccount;
  newPassword: string;
  confirmPassword: string;
}

function initialsOfName(name: string, email = "") {
  const cleaned = name.trim() || email || "PG";
  return name.trim()
    ? name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => Array.from(word)[0])
        .join("")
        .toUpperCase()
    : Array.from(cleaned).slice(0, 2).join("").toUpperCase();
}

export default function ManageAccountsPage() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale || "id";
  const { theme, dark, toggleTheme } = useTheme();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);

  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");

  const [accountModal, setAccountModal] = useState<AccountModalState | null>(
    null
  );
  const [confirmDiscardAccount, setConfirmDiscardAccount] = useState(false);

  const [passwordModal, setPasswordModal] =
    useState<PasswordModalState | null>(null);
  const [confirmDiscardPassword, setConfirmDiscardPassword] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ManagedAccount | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const loadAccounts = useCallback(async () => {
    const res = await getAccountsAction();
    if (res.success) {
      setAccounts(res.accounts);
    } else if (res.errorMessage) {
      toast.error(res.errorMessage);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const session = await api.getSession();
        if (!session) {
          window.location.href = `/${locale}/login`;
          return;
        }
        if (session.role !== "OPERATOR") {
          window.location.href = `/${locale}/${
            session.role === "TECHNICIAN" ? "technician" : "reports"
          }`;
          return;
        }
        if (active) setUser(session);
        const res = await getAccountsAction();
        if (active && res.success) {
          setAccounts(res.accounts);
        } else if (active && res.errorMessage) {
          toast.error(res.errorMessage);
        }
      } catch (e) {
        if (active) toast.error(message(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [locale]);

  const totalAccounts = accounts.length;
  const totalOperators = accounts.filter((a) => a.role === "OPERATOR").length;
  const totalFieldStaff = accounts.filter(
    (a) => a.role === "REPORTER" || a.role === "TECHNICIAN"
  ).length;
  const totalActive = accounts.filter((a) => a.status === "ACTIVE").length;

  const normalizedQuery = search.trim().toLocaleLowerCase("id");

  const filteredAccounts = accounts.filter((account) => {
    if (roleFilter !== "ALL" && account.role !== roleFilter) return false;
    if (statusFilter !== "ALL" && account.status !== statusFilter) return false;
    if (!normalizedQuery) return true;
    return (
      account.name.toLocaleLowerCase("id").includes(normalizedQuery) ||
      account.nip.toLocaleLowerCase("id").includes(normalizedQuery) ||
      (account.phone || "").toLocaleLowerCase("id").includes(normalizedQuery) ||
      account.email.toLocaleLowerCase("id").includes(normalizedQuery) ||
      account.unit.toLocaleLowerCase("id").includes(normalizedQuery) ||
      roleLabels[account.role].toLocaleLowerCase("id").includes(normalizedQuery)
    );
  });

  function openCreateAccountModal() {
    setConfirmDiscardAccount(false);
    setAccountModal({
      mode: "CREATE",
      nip: "",
      name: "",
      email: "",
      phone: "",
      role: "REPORTER",
      unit: "Airport Security (AVSEC)",
      status: "ACTIVE",
      password: "",
    });
  }

  function openEditAccountModal(account: ManagedAccount) {
    setConfirmDiscardAccount(false);
    setAccountModal({
      mode: "EDIT",
      accountId: account.id,
      nip: account.nip,
      name: account.name,
      email: account.email,
      phone: account.phone || "",
      role: account.role,
      unit: account.unit,
      status: account.status,
      password: "",
    });
  }

  function isAccountModalDirty(): boolean {
    if (!accountModal) return false;
    if (accountModal.mode === "CREATE") {
      return (
        accountModal.name.trim() !== "" ||
        accountModal.nip.trim() !== "" ||
        accountModal.phone.trim() !== "" ||
        accountModal.password.trim() !== "" ||
        accountModal.role !== "REPORTER" ||
        accountModal.status !== "ACTIVE" ||
        accountModal.unit.trim() !== "Airport Security (AVSEC)"
      );
    }
    const original = accounts.find((a) => a.id === accountModal.accountId);
    if (!original) return false;
    return (
      accountModal.name.trim() !== original.name.trim() ||
      accountModal.nip.trim() !== original.nip.trim() ||
      accountModal.phone.trim() !== (original.phone || "").trim() ||
      accountModal.role !== original.role ||
      accountModal.unit.trim() !== original.unit.trim() ||
      accountModal.status !== original.status
    );
  }

  function requestCloseAccountModal() {
    if (isAccountModalDirty() && !confirmDiscardAccount) {
      setConfirmDiscardAccount(true);
      return;
    }
    setConfirmDiscardAccount(false);
    setAccountModal(null);
  }

  function isPasswordModalDirty(): boolean {
    if (!passwordModal) return false;
    return (
      passwordModal.newPassword.trim() !== "" ||
      passwordModal.confirmPassword.trim() !== ""
    );
  }

  function requestClosePasswordModal() {
    if (isPasswordModalDirty() && !confirmDiscardPassword) {
      setConfirmDiscardPassword(true);
      return;
    }
    setConfirmDiscardPassword(false);
    setPasswordModal(null);
  }

  async function handleSaveAccountModal(e: FormEvent) {
    e.preventDefault();
    if (!accountModal || actionBusy) return;

    const cleanedPhone = accountModal.phone.trim();
    if (!cleanedPhone || cleanedPhone.length < 10 || cleanedPhone.length > 13) {
      toast.error(
        "Nomor kontak telepon harus berupa angka antara 10 sampai 13 digit."
      );
      return;
    }

    setActionBusy(true);
    try {
      if (accountModal.mode === "CREATE") {
        if (accountModal.password.trim().length < 6) {
          toast.error("Password awal minimal terdiri dari 6 karakter.");
          setActionBusy(false);
          return;
        }

        const res = await createAccountAction({
          nip: accountModal.nip,
          name: accountModal.name,
          email: accountModal.email,
          phone: accountModal.phone,
          role: accountModal.role,
          unit: accountModal.unit,
          status: accountModal.status,
          password: accountModal.password,
        });

        if (!res.success) {
          toast.error(res.errorMessage || "Gagal membuat akun.");
          setActionBusy(false);
          return;
        }

        const accountRole = (res.account?.role as UserRole) || "REPORTER";
        toast.success("Akun baru berhasil dibuat", {
          description: `${res.account?.name} (${roleLabels[accountRole]}) telah terdaftar.`,
        });
        await loadAccounts();
      } else if (accountModal.accountId) {
        const res = await updateAccountAction(accountModal.accountId, {
          nip: accountModal.nip,
          name: accountModal.name,
          email: accountModal.email,
          phone: accountModal.phone,
          role: accountModal.role,
          unit: accountModal.unit,
          status: accountModal.status,
        });

        if (!res.success) {
          toast.error(res.errorMessage || "Gagal memperbarui akun.");
          setActionBusy(false);
          return;
        }

        toast.success("Data akun diperbarui", {
          description: `Perubahan pada akun "${accountModal.name}" telah disimpan.`,
        });
        await loadAccounts();
      }
      setConfirmDiscardAccount(false);
      setAccountModal(null);
    } catch (err) {
      toast.error(message(err));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleToggleAccountStatus(account: ManagedAccount) {
    if (actionBusy) return;
    const nextStatus = account.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setActionBusy(true);
    try {
      const res = await toggleAccountStatusAction(account.id, nextStatus);
      if (!res.success) {
        toast.error(res.errorMessage || "Gagal mengubah status akun.");
        return;
      }
      toast.success(
        nextStatus === "ACTIVE"
          ? `Akun ${account.name} diaktifkan`
          : `Akun ${account.name} dinonaktifkan`
      );
      await loadAccounts();
    } catch (err) {
      toast.error(message(err));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleSavePasswordModal(e: FormEvent) {
    e.preventDefault();
    if (!passwordModal || actionBusy) return;

    if (passwordModal.newPassword.trim().length < 6) {
      toast.error("Password baru minimal 6 karakter.");
      return;
    }
    if (passwordModal.newPassword !== passwordModal.confirmPassword) {
      toast.error("Konfirmasi password tidak cocok.");
      return;
    }

    setActionBusy(true);
    try {
      const res = await resetAccountPasswordAction(
        passwordModal.account.id,
        passwordModal.newPassword
      );

      if (!res.success) {
        toast.error(res.errorMessage || "Gagal mereset password akun.");
        return;
      }

      toast.success("Password berhasil direset", {
        description: `Kredensial login untuk ${passwordModal.account.name} (${passwordModal.account.nip}) telah diperbarui.`,
      });
      setConfirmDiscardPassword(false);
      setPasswordModal(null);
    } catch (err) {
      toast.error(message(err));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || actionBusy) return;
    setActionBusy(true);
    try {
      const res = await deleteAccountAction(deleteTarget.id);
      if (!res.success) {
        toast.error(res.errorMessage || "Gagal menghapus akun.");
        return;
      }
      toast.success("Akun dihapus", {
        description: `Akun "${deleteTarget.name}" (${deleteTarget.nip}) telah dihapus.`,
      });
      setDeleteTarget(null);
      await loadAccounts();
    } catch (err) {
      toast.error(message(err));
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div
      className="operator-dashboard flex min-h-dvh flex-col bg-[var(--rd-bg)] text-[var(--rd-text)]"
      data-theme={theme}
    >
      <AppHeader
        user={user}
        dark={dark}
        onToggleTheme={toggleTheme}
        roleLabel="Operator perimeter"
        containerClassName="max-w-[1700px] min-[1100px]:px-[5%]"
      />

      <main className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col px-3 pt-4 md:px-[3%] md:pt-6 min-[1100px]:px-[5%]">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="mb-3 flex items-center gap-2 text-xs md:text-[13px]"
        >
          <Link
            href={`/${locale}/operator`}
            className="text-[var(--rd-muted)] transition-colors hover:text-[var(--rd-link)]"
          >
            Dashboard
          </Link>
          <span className="text-[var(--rd-muted)]/50 select-none">/</span>
          <span className="font-medium text-[var(--rd-link)]">
            Kelola Akun Pengguna
          </span>
        </nav>

        {/* Page Title & Action Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="m-0 text-xl font-semibold sm:text-2xl">
              Manajemen Akun Personel
            </h1>
            <p className="m-0 mt-1 text-xs text-[var(--rd-muted)] sm:text-sm">
              Kelola kredensial, peran akses, dan status operasional akun
              petugas perimeter.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={openCreateAccountModal}
              disabled={loading || actionBusy}
              className={`${btnPrimary} flex items-center gap-2 disabled:opacity-50`}
            >
              <UserPlus size={16} aria-hidden="true" />
              <span>Tambah Akun</span>
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 md:mb-6">
          <div className="flex items-center gap-3.5 rounded-[14px] border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--rd-active)] text-[var(--rd-link)]">
              <Users size={22} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div>
              <span className="block text-xs text-[var(--rd-muted)]">
                Total Akun Terdaftar
              </span>
              {loading ? (
                <Skeleton className="mt-1 h-6 w-20 rounded-md" />
              ) : (
                <strong className="text-xl font-semibold text-[var(--rd-text)]">
                  {totalAccounts} <span className="text-xs font-normal text-[var(--rd-muted)]">pengguna</span>
                </strong>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-[14px] border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--rd-active)] text-[var(--rd-link)]">
              <ShieldCheck size={22} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div>
              <span className="block text-xs text-[var(--rd-muted)]">
                Operator Perimeter
              </span>
              {loading ? (
                <Skeleton className="mt-1 h-6 w-20 rounded-md" />
              ) : (
                <strong className="text-xl font-semibold text-[var(--rd-text)]">
                  {totalOperators} <span className="text-xs font-normal text-[var(--rd-muted)]">operator</span>
                </strong>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-[14px] border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--rd-brown)]/15 text-[var(--rd-brown)]">
              <Wrench size={21} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div>
              <span className="block text-xs text-[var(--rd-muted)]">
                Pelapor & Teknisi
              </span>
              {loading ? (
                <Skeleton className="mt-1 h-6 w-24 rounded-md" />
              ) : (
                <strong className="text-xl font-semibold text-[var(--rd-text)]">
                  {totalFieldStaff} <span className="text-xs font-normal text-[var(--rd-muted)]">personel lapangan</span>
                </strong>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-[14px] border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--rd-lime)]/15 text-[var(--rd-lime)]">
              <UserCheck size={22} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div>
              <span className="block text-xs text-[var(--rd-muted)]">
                Status Akun Aktif
              </span>
              {loading ? (
                <Skeleton className="mt-1 h-6 w-24 rounded-md" />
              ) : (
                <strong className="text-xl font-semibold text-[var(--rd-text)]">
                  {totalActive} <span className="text-xs font-normal text-[var(--rd-muted)]">dari {totalAccounts} akun</span>
                </strong>
              )}
            </div>
          </div>
        </div>

        {/* Content Section: Table & Filters */}
        <section
          aria-label="Tabel daftar akun personel"
          className="mb-8 rounded-2xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] shadow-xs"
        >
          {/* Controls Bar */}
          <div className="flex flex-col gap-3 border-b border-solid border-[var(--rd-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Filter by Role Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="tablist"
                aria-label="Filter peran akses"
                className="flex rounded-xl bg-[var(--rd-bg)] p-1 text-xs"
              >
                {(
                  [
                    ["ALL", `Semua (${accounts.length})`],
                    ["OPERATOR", `Operator (${accounts.filter((a) => a.role === "OPERATOR").length})`],
                    ["REPORTER", `Pelapor (${accounts.filter((a) => a.role === "REPORTER").length})`],
                    ["TECHNICIAN", `Teknisi (${accounts.filter((a) => a.role === "TECHNICIAN").length})`],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={roleFilter === value}
                    onClick={() => setRoleFilter(value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${focusRing} ${
                      roleFilter === value
                        ? "bg-[var(--rd-surface)] text-[var(--rd-link)] shadow-xs"
                        : "text-[var(--rd-muted)] hover:text-[var(--rd-text)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Filter by Status */}
              <select
                aria-label="Filter status akun"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
                className={`min-h-9 rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] px-3 py-1.5 text-xs font-medium text-[var(--rd-text)] ${focusRing}`}
              >
                <option value="ALL">Semua Status</option>
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Nonaktif</option>
              </select>
            </div>

            {/* Search Input */}
            <label className="flex w-full items-center gap-2 rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] px-3 lg:max-w-xs focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--rd-link)]">
              <Search
                size={16}
                className="shrink-0 text-[var(--rd-muted)]"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Cari akun pengguna"
                placeholder="Cari nama, NIP, kontak, atau unit…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent py-2 text-xs text-[var(--rd-text)] outline-none placeholder:text-[var(--rd-muted)] sm:text-sm"
              />
            </label>
          </div>

          {/* Accounts Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 text-center">No</TableHead>
                <TableHead>Pengguna</TableHead>
                <TableHead>NIP & Unit Kerja</TableHead>
                <TableHead className="w-44">Kontak Person</TableHead>
                <TableHead className="w-44">Peran Akses</TableHead>
                <TableHead className="w-32 text-center">Status</TableHead>
                <TableHead className="w-44">Terdaftar</TableHead>
                <TableHead className="w-36 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [0, 1, 2, 3].map((index) => (
                  <TableRow key={index}>
                    <TableCell className="text-center">
                      <Skeleton className="mx-auto h-4 w-6 rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-9 shrink-0 rounded-xl" />
                        <Skeleton className="h-4 w-36 rounded" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="mb-1.5 h-3.5 w-28 rounded" />
                      <Skeleton className="h-3 w-36 rounded" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28 rounded" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-28 rounded-full" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="mx-auto h-5 w-16 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-3.5 w-28 rounded" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex justify-end gap-1.5">
                        <Skeleton className="size-8 rounded-lg" />
                        <Skeleton className="size-8 rounded-lg" />
                        <Skeleton className="size-8 rounded-lg" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <>
                  {filteredAccounts.map((account, index) => {
                    const initials = initialsOfName(
                      account.name,
                      account.email
                    );
                    const isSelf = user?.id === account.id;

                    const roleBadgeClass =
                      account.role === "OPERATOR"
                        ? "bg-[var(--rd-link)]/15 text-[var(--rd-link)]"
                        : account.role === "TECHNICIAN"
                        ? "bg-[var(--rd-brown)]/15 text-[var(--rd-brown)]"
                        : "bg-[var(--rd-active)] text-[var(--rd-teal)]";

                    return (
                      <TableRow key={account.id}>
                        <TableCell className="text-center font-mono text-xs text-[var(--rd-muted)]">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--rd-border)] text-xs font-bold text-[var(--rd-text)]">
                              {initials}
                            </span>
                            <div className="min-w-0">
                              <span className="block truncate text-sm font-semibold">
                                {account.name}
                                {isSelf && (
                                  <span className="ml-1.5 rounded-sm bg-[var(--rd-active)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--rd-link)]">
                                    Anda
                                  </span>
                                )}
                              </span>
                              <span className="block truncate text-xs text-[var(--rd-muted)]">
                                {account.email}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="block font-mono text-xs font-semibold">
                            {account.nip}
                          </span>
                          <span className="block truncate text-xs text-[var(--rd-muted)]">
                            {account.unit}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-xs text-[var(--rd-text)]">
                            <Phone
                              size={13}
                              className="shrink-0 text-[var(--rd-muted)]"
                              aria-hidden="true"
                            />
                            <span>{account.phone || "-"}</span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadgeClass}`}
                          >
                            {roleLabels[account.role]}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleAccountStatus(account)}
                            disabled={actionBusy || isSelf}
                            title={
                              isSelf
                                ? "Anda tidak dapat menonaktifkan akun sendiri"
                                : "Klik untuk ubah status aktif/nonaktif"
                            }
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${
                              account.status === "ACTIVE"
                                ? "bg-[var(--rd-lime)]/15 text-[var(--rd-lime)]"
                                : "bg-[var(--rd-border)] text-[var(--rd-muted)]"
                            }`}
                          >
                            <CheckCircle2 size={12} aria-hidden="true" />
                            <span>
                              {account.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
                            </span>
                          </button>
                        </TableCell>
                        <TableCell className="text-xs text-[var(--rd-muted)]">
                          {dateText(account.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditAccountModal(account)}
                              disabled={actionBusy}
                              className={btnIcon}
                              title={`Ubah akun ${account.name}`}
                              aria-label={`Ubah akun ${account.name}`}
                            >
                              <Pencil size={16} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDiscardPassword(false);
                                setPasswordModal({
                                  account,
                                  newPassword: "",
                                  confirmPassword: "",
                                });
                              }}
                              disabled={actionBusy}
                              className={btnIcon}
                              title={`Reset password ${account.name}`}
                              aria-label={`Reset password ${account.name}`}
                            >
                              <KeyRound size={16} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(account)}
                              disabled={actionBusy || isSelf}
                              className={`${btnIcon} hover:!bg-[var(--rd-coral)]/15 hover:!text-[var(--rd-coral)] disabled:opacity-30 disabled:cursor-not-allowed`}
                              title={
                                isSelf
                                  ? "Tidak dapat menghapus akun sendiri"
                                  : `Hapus akun ${account.name}`
                              }
                              aria-label={`Hapus akun ${account.name}`}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredAccounts.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-12 text-center text-[var(--rd-muted)]"
                      >
                        Tidak ada akun pengguna yang cocok dengan filter pencarian.
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </section>

        <DashboardFooter />
      </main>

      {/* Modal: Create / Edit Account */}
      {accountModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-modal-title"
          className="fixed inset-0 z-[700] grid place-items-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestCloseAccountModal();
          }}
        >
          <div className="my-auto w-full max-w-lg rounded-2xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-5 text-[var(--rd-text)] shadow-xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2
                id="account-modal-title"
                className="m-0 text-lg font-semibold"
              >
                {accountModal.mode === "CREATE"
                  ? "Tambah Akun Pengguna"
                  : "Ubah Data Akun"}
              </h2>
              <button
                type="button"
                onClick={requestCloseAccountModal}
                className={btnCloseCoral}
                aria-label="Tutup dialog"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveAccountModal}>
              <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                <label className={fieldLabel}>
                  Nama Lengkap
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Nama Lengkap"
                    value={accountModal.name}
                    onChange={(e) => {
                      setConfirmDiscardAccount(false);
                      setAccountModal({ ...accountModal, name: e.target.value });
                    }}
                    className={fieldControl}
                  />
                </label>

                <label className={fieldLabel}>
                  NIP (Nomor Induk Pegawai)
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 19950412202101"
                    value={accountModal.nip}
                    onChange={(e) => {
                      setConfirmDiscardAccount(false);
                      setAccountModal({ ...accountModal, nip: e.target.value });
                    }}
                    className={fieldControl}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                <label className={fieldLabel}>
                  Nomor Kontak Telepon
                  <input
                    type="tel"
                    required
                    maxLength={13}
                    placeholder="Contoh: 089999999999"
                    value={accountModal.phone}
                    onChange={(e) => {
                      setConfirmDiscardAccount(false);
                      setAccountModal({
                        ...accountModal,
                        phone: e.target.value.replace(/\D/g, "").slice(0, 13),
                      });
                    }}
                    className={fieldControl}
                  />
                </label>

                <label className={fieldLabel}>
                  Peran Akses (Role)
                  <select
                    value={accountModal.role}
                    onChange={(e) => {
                      setConfirmDiscardAccount(false);
                      setAccountModal({
                        ...accountModal,
                        role: e.target.value as UserRole,
                      });
                    }}
                    className={fieldControl}
                  >
                    <option value="REPORTER">Pelapor Lapangan</option>
                    <option value="OPERATOR">Operator Perimeter</option>
                    <option value="TECHNICIAN">Teknisi</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                <label className={fieldLabel}>
                  Unit Kerja / Divisi
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Airport Security (AVSEC)"
                    value={accountModal.unit}
                    onChange={(e) => {
                      setConfirmDiscardAccount(false);
                      setAccountModal({ ...accountModal, unit: e.target.value });
                    }}
                    className={fieldControl}
                  />
                </label>

                <label className={fieldLabel}>
                  Status Akun
                  <select
                    value={accountModal.status}
                    onChange={(e) => {
                      setConfirmDiscardAccount(false);
                      setAccountModal({
                        ...accountModal,
                        status: e.target.value as AccountStatus,
                      });
                    }}
                    className={fieldControl}
                  >
                    <option value="ACTIVE">Aktif</option>
                    <option value="INACTIVE">Nonaktif</option>
                  </select>
                </label>
              </div>

              {accountModal.mode === "CREATE" && (
                <label className={fieldLabel}>
                  Password Awal
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Minimal 6 karakter"
                    value={accountModal.password}
                    onChange={(e) => {
                      setConfirmDiscardAccount(false);
                      setAccountModal({
                        ...accountModal,
                        password: e.target.value,
                      });
                    }}
                    className={fieldControl}
                  />
                </label>
              )}

              {confirmDiscardAccount && (
                <div
                  role="alert"
                  className="mb-4 rounded-xl border border-solid border-[var(--rd-coral)]/40 bg-[var(--rd-coral)]/10 p-3 text-xs leading-relaxed text-[var(--rd-text)]"
                >
                  <strong className="block font-semibold text-[var(--rd-coral)]">
                    Batalkan pengisian data akun?
                  </strong>
                  <span className="text-[var(--rd-muted)]">
                    Data yang sudah Anda ketik belum disimpan dan akan hilang
                    jika dialog ditutup.
                  </span>
                  <div className="mt-2.5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDiscardAccount(false)}
                      className={`${btnBase} min-h-8 rounded-lg border-[var(--rd-border)] bg-[var(--rd-surface)] px-3 py-1 text-xs text-[var(--rd-text)] hover:bg-[var(--rd-hover)]`}
                    >
                      Lanjut Mengisi
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDiscardAccount(false);
                        setAccountModal(null);
                      }}
                      className={`${btnBase} min-h-8 rounded-lg bg-[var(--rd-coral)] px-3 py-1 text-xs text-white hover:brightness-95`}
                    >
                      Ya, Batalkan
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={requestCloseAccountModal}
                  disabled={actionBusy}
                  className={btnCancelCoral}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className={`${btnPrimary} disabled:opacity-50`}
                >
                  {actionBusy
                    ? "Menyimpan…"
                    : accountModal.mode === "CREATE"
                    ? "Buat Akun"
                    : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Password */}
      {passwordModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="password-modal-title"
          className="fixed inset-0 z-[700] grid place-items-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestClosePasswordModal();
          }}
        >
          <div className="my-auto w-full max-w-md rounded-2xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-5 text-[var(--rd-text)] shadow-xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2
                id="password-modal-title"
                className="m-0 text-lg font-semibold"
              >
                Reset Password Akun
              </h2>
              <button
                type="button"
                onClick={requestClosePasswordModal}
                className={btnCloseCoral}
                aria-label="Tutup dialog"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <p className="m-0 mb-4 rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] p-3 text-xs text-[var(--rd-muted)]">
              Atur ulang password untuk{" "}
              <strong className="text-[var(--rd-text)]">
                {passwordModal.account.name}
              </strong>{" "}
              (NIP: {passwordModal.account.nip}).
            </p>

            <form onSubmit={handleSavePasswordModal}>
              <label className={fieldLabel}>
                Password Baru
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimal 6 karakter"
                  value={passwordModal.newPassword}
                  onChange={(e) => {
                    setConfirmDiscardPassword(false);
                    setPasswordModal({
                      ...passwordModal,
                      newPassword: e.target.value,
                    });
                  }}
                  className={fieldControl}
                />
              </label>

              <label className={fieldLabel}>
                Konfirmasi Password Baru
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Ketik ulang password baru"
                  value={passwordModal.confirmPassword}
                  onChange={(e) => {
                    setConfirmDiscardPassword(false);
                    setPasswordModal({
                      ...passwordModal,
                      confirmPassword: e.target.value,
                    });
                  }}
                  className={fieldControl}
                />
              </label>

              {confirmDiscardPassword && (
                <div
                  role="alert"
                  className="mb-4 rounded-xl border border-solid border-[var(--rd-coral)]/40 bg-[var(--rd-coral)]/10 p-3 text-xs leading-relaxed text-[var(--rd-text)]"
                >
                  <strong className="block font-semibold text-[var(--rd-coral)]">
                    Batalkan reset password?
                  </strong>
                  <span className="text-[var(--rd-muted)]">
                    Password baru yang sudah diketik belum disimpan dan akan
                    hilang.
                  </span>
                  <div className="mt-2.5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDiscardPassword(false)}
                      className={`${btnBase} min-h-8 rounded-lg border-[var(--rd-border)] bg-[var(--rd-surface)] px-3 py-1 text-xs text-[var(--rd-text)] hover:bg-[var(--rd-hover)]`}
                    >
                      Lanjut Mengisi
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDiscardPassword(false);
                        setPasswordModal(null);
                      }}
                      className={`${btnBase} min-h-8 rounded-lg bg-[var(--rd-coral)] px-3 py-1 text-xs text-white hover:brightness-95`}
                    >
                      Ya, Batalkan
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={requestClosePasswordModal}
                  disabled={actionBusy}
                  className={btnCancelCoral}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className={`${btnPrimary} disabled:opacity-50`}
                >
                  {actionBusy ? "Menyimpan…" : "Simpan Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-modal-title"
          className="fixed inset-0 z-[700] grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-5 text-[var(--rd-text)] shadow-xl sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 text-[var(--rd-coral)]">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--rd-coral)]/15">
                  <AlertTriangle size={20} aria-hidden="true" />
                </span>
                <h2
                  id="delete-account-modal-title"
                  className="m-0 text-base font-semibold"
                >
                  Hapus Akun Pengguna?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className={btnCloseCoral}
                aria-label="Tutup dialog"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="m-0 mb-5 text-xs leading-relaxed text-[var(--rd-muted)] sm:text-sm">
              Akun{" "}
              <strong className="text-[var(--rd-text)]">
                {deleteTarget.name}
              </strong>{" "}
              (NIP: {deleteTarget.nip}) akan dihapus dari daftar akses sistem.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={actionBusy}
                className={btnCancelCoral}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={actionBusy}
                className={`${btnDanger} disabled:opacity-50`}
              >
                {actionBusy ? "Menghapus…" : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reset Confirmation */}
      {confirmReset && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-account-modal-title"
          className="fixed inset-0 z-[700] grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmReset(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-5 text-[var(--rd-text)] shadow-xl sm:p-6">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2
                id="reset-account-modal-title"
                className="m-0 text-base font-semibold"
              >
                Segarkan Daftar Akun?
              </h2>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className={btnCloseCoral}
                aria-label="Tutup dialog"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="m-0 mb-5 text-xs leading-relaxed text-[var(--rd-muted)] sm:text-sm">
              Muat ulang seluruh data akun personel langsung dari database.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className={btnCancelCoral}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmReset(false);
                  await loadAccounts();
                  toast.success("Daftar akun diperbarui.");
                }}
                className={btnPrimary}
              >
                Ya, Segarkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
