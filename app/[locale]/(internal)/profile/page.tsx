"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  ClipboardClock,
  ClipboardPen,
  ClipboardX,
  Clock,
  IdCard,
  Lock,
  MapPin,
  Phone,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  api,
  type ReportRecord,
  type SessionUser,
} from "../../_lib/client-api";
import { roleLabels, useAccountsStore } from "../../_lib/accounts-store";
import { dateText, message } from "../../_lib/draft-store";
import {
  btnPrimary,
  btnSecondary,
  fieldControl,
  focusRing,
} from "../../_lib/ui-classes";
import { useTheme } from "../../_lib/use-theme";
import { AppHeader } from "../../_components/app-header";
import { DashboardFooter } from "../operator/_components/dashboard-footer";
import { toast } from "@/components/ui/sonner";

const readOnlyInput =
  "m-0 block w-full cursor-not-allowed rounded-[10px] border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)]/80 px-3.5 py-2.5 text-sm text-[var(--rd-muted)] opacity-85 select-all";

const statusMeta: Record<
  string,
  { label: string; icon: typeof ClipboardClock }
> = {
  OPEN: { label: "Baru", icon: ClipboardClock },
  IN_PROGRESS: { label: "Ditangani", icon: ClipboardPen },
  RESOLVED: { label: "Selesai", icon: ClipboardCheck },
  CLOSED: { label: "Ditutup", icon: ClipboardX },
};

export default function ProfilePage() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale || "id";
  const { theme, dark, toggleTheme } = useTheme();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const accounts = useAccountsStore((state) => state.accounts);
  const updateProfile = useAccountsStore((state) => state.updateProfile);

  const account = user
    ? accounts.find((acc) => acc.id === user.id) || null
    : null;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [session, reportItems] = await Promise.all([
          api.getSession(),
          api.listReports(),
        ]);
        if (active) {
          setUser(session);
          setReports(reportItems);
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
  }, []);

  useEffect(() => {
    if (account) {
      setName(account.name);
      setPhone(account.phone || "");
      setAvatarUrl(account.avatarUrl || null);
    } else if (user) {
      setName(user.name);
    }
  }, [account, user]);

  function handleSelectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Format foto tidak didukung. Gunakan JPG, PNG, atau WebP.");
      return;
    }
    if (file.size > 2_000_000) {
      toast.error("Ukuran foto maksimal 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
      }
    };
    reader.onerror = () => {
      toast.error("Gagal membaca file foto.");
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    try {
      const cleanedName = name.trim();
      const cleanedPhone = phone.trim();
      if (!cleanedName) {
        toast.error("Nama lengkap tidak boleh kosong.");
        return;
      }
      if (!cleanedPhone) {
        toast.error("Nomor kontak telepon wajib diisi.");
        return;
      }

      updateProfile(user.id, {
        name: cleanedName,
        phone: cleanedPhone,
        avatarUrl,
      });

      toast.success("Profil berhasil diperbarui", {
        description: "Avatar, nama lengkap, dan nomor kontak telah disimpan.",
      });
    } catch (err) {
      toast.error(message(err));
    }
  }

  const role = account?.role || user?.role || "REPORTER";
  const isOperator = role === "OPERATOR";
  const isTechnician = role === "TECHNICIAN";

  const roleCaption = isOperator
    ? "Operator perimeter"
    : isTechnician
      ? "Teknisi perimeter"
      : "Reporter perimeter";

  const homeRoute = isOperator
    ? `/${locale}/operator`
    : isTechnician
      ? `/${locale}/technician`
      : `/${locale}/reports`;

  const homeLabel = "Dashboard";

  const scopedReports =
    isOperator || isTechnician
      ? reports
      : reports.filter((r) => !user || r.reporterId === user.id);

  const totalCount = scopedReports.length;
  const activeCount = scopedReports.filter(
    (r) => !r.deletedAt && (r.status === "OPEN" || r.status === "IN_PROGRESS")
  ).length;
  const resolvedCount = scopedReports.filter(
    (r) => !r.deletedAt && r.status === "RESOLVED"
  ).length;

  const latestReports = [...scopedReports]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 3);

  const displayName = name.trim() || account?.name || user?.name || "Pengguna";
  const displayUnit = account?.unit || "Operasional Bandara";
  const displayNip = account?.nip || "-";
  const displayPhone = phone.trim() || account?.phone || "Belum diatur";
  const isAccountActive = account?.status !== "INACTIVE";

  return (
    <div
      className={`${
        isOperator || isTechnician ? "operator-dashboard" : "reporter-dashboard"
      } flex min-h-dvh flex-col bg-[var(--rd-bg)] text-[var(--rd-text)]`}
      data-theme={theme}
    >
      <AppHeader
        user={user}
        dark={dark}
        onToggleTheme={toggleTheme}
        roleLabel={roleCaption}
        containerClassName="max-w-[1700px] min-[1100px]:px-[5%]"
      />

      <main className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col px-3 pt-4 md:px-[3%] md:pt-6 min-[1100px]:px-[5%]">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="mb-3 flex items-center gap-2 text-xs md:text-[13px]"
        >
          <Link
            href={homeRoute}
            className="text-[var(--rd-muted)] transition-colors hover:text-[var(--rd-link)]"
          >
            {homeLabel}
          </Link>
          <span className="text-[var(--rd-muted)]/50 select-none">/</span>
          <span className="font-medium text-[var(--rd-link)]">Profil Saya</span>
        </nav>

        {/* Title */}
        <div className="mb-[18px] md:mb-[26px]">
          <h1 className="m-0 mb-1.5 text-xl leading-tight font-normal sm:text-3xl">
            Profil Saya,
          </h1>
          <p className="m-0 text-xs text-[var(--rd-muted)] sm:text-sm">
            Perbarui foto profil, nama tampilan, dan nomor kontak telepon Anda.
          </p>
        </div>

        {/* 2-Column Desktop Layout (matches reference design & operator container width) */}
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[350px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)] xl:gap-6">
          {/* LEFT CARD: Identity, Stats & Contact Metadata */}
          <aside
            aria-label="Ringkasan Identitas Pengguna"
            className="rounded-2xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-5 shadow-xs sm:p-6 lg:sticky lg:top-6"
          >
            {/* Avatar & Name */}
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-3.5 grid size-24 place-items-center overflow-hidden rounded-full border-2 border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] text-[var(--rd-muted)]">
                {loading ? (
                  <Skeleton className="size-full rounded-full" />
                ) : avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="grid size-12 place-items-center rounded-full border border-solid border-[var(--rd-border)] text-[var(--rd-muted)]">
                    <UserRound size={26} strokeWidth={1.7} aria-hidden="true" />
                  </span>
                )}
              </div>

              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <Skeleton className="h-6 w-44 rounded-md" />
                  <Skeleton className="h-4 w-32 rounded-md" />
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <h2 className="m-0 text-lg font-bold tracking-normal text-[var(--rd-text)]">
                      {displayName}
                    </h2>
                    <span className="inline-flex items-center rounded-md border border-solid border-[var(--rd-link)]/30 bg-[var(--rd-active)] px-2 py-0.5 text-[11px] font-semibold text-[var(--rd-link)]">
                      {roleLabels[role]}
                    </span>
                  </div>
                  <p className="m-0 mt-1 text-xs text-[var(--rd-muted)]">
                    {displayUnit}
                  </p>
                </>
              )}
            </div>

            {/* 3-Column Stats Bar */}
            <div className="my-6 grid grid-cols-3 divide-x divide-[var(--rd-border)] rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)]/60 py-3.5 text-center">
              <div className="px-2">
                {loading ? (
                  <Skeleton className="mx-auto mb-1 h-5 w-8 rounded" />
                ) : (
                  <span className="block text-base font-bold text-[var(--rd-text)] sm:text-lg">
                    {totalCount}
                  </span>
                )}
                <span className="mt-0.5 block text-[11px] text-[var(--rd-muted)]">
                  Laporan
                </span>
              </div>
              <div className="px-2">
                {loading ? (
                  <Skeleton className="mx-auto mb-1 h-5 w-8 rounded" />
                ) : (
                  <span className="block text-base font-bold text-[var(--rd-text)] sm:text-lg">
                    {activeCount}
                  </span>
                )}
                <span className="mt-0.5 block text-[11px] text-[var(--rd-muted)]">
                  Ditangani
                </span>
              </div>
              <div className="px-2">
                {loading ? (
                  <Skeleton className="mx-auto mb-1 h-5 w-8 rounded" />
                ) : (
                  <span className="block text-base font-bold text-[var(--rd-text)] sm:text-lg">
                    {resolvedCount}
                  </span>
                )}
                <span className="mt-0.5 block text-[11px] text-[var(--rd-muted)]">
                  Selesai
                </span>
              </div>
            </div>

            {/* Contact & Metadata List */}
            <ul className="m-0 list-none space-y-3.5 p-0 text-xs sm:text-[13px]">
              <li className="flex items-center gap-3 text-[var(--rd-text)]">
                <IdCard
                  size={16}
                  className="shrink-0 text-[var(--rd-muted)]"
                  aria-hidden="true"
                />
                <span className="truncate font-mono" title={`NIP ${displayNip}`}>
                  NIP {displayNip}
                </span>
              </li>
              <li className="flex items-center gap-3 text-[var(--rd-text)]">
                <Phone
                  size={16}
                  className="shrink-0 text-[var(--rd-muted)]"
                  aria-hidden="true"
                />
                <span className="truncate font-mono">{displayPhone}</span>
              </li>
              <li className="flex items-center gap-3 text-[var(--rd-text)]">
                <Building2
                  size={16}
                  className="shrink-0 text-[var(--rd-muted)]"
                  aria-hidden="true"
                />
                <span className="truncate">{displayUnit}</span>
              </li>
              <li className="flex items-center gap-3 text-[var(--rd-text)]">
                <MapPin
                  size={16}
                  className="shrink-0 text-[var(--rd-muted)]"
                  aria-hidden="true"
                />
                <span className="truncate">
                  Yogyakarta International Airport
                </span>
              </li>
              <li className="flex items-center gap-3 text-[var(--rd-text)]">
                <ShieldCheck
                  size={16}
                  className="shrink-0 text-[var(--rd-muted)]"
                  aria-hidden="true"
                />
                <span className="flex items-center gap-1.5">
                  Status Akun:{" "}
                  <strong
                    className={
                      isAccountActive
                        ? "font-semibold text-[var(--rd-lime)]"
                        : "font-semibold text-[var(--rd-muted)]"
                    }
                  >
                    {isAccountActive ? "Aktif" : "Nonaktif"}
                  </strong>
                </span>
              </li>
              <li className="flex items-center gap-3 text-[var(--rd-text)]">
                <Calendar
                  size={16}
                  className="shrink-0 text-[var(--rd-muted)]"
                  aria-hidden="true"
                />
                <span className="truncate text-[var(--rd-muted)]">
                  Terdaftar{" "}
                  {account?.createdAt ? dateText(account.createdAt) : "-"}
                </span>
              </li>
            </ul>
          </aside>

          {/* RIGHT COLUMN: Edit Profile Card + Latest Activity Timeline Card */}
          <div className="min-w-0 space-y-5 xl:space-y-6">
            {/* Profile Form Card */}
            <section
              aria-label="Pengaturan Profil Pengguna"
              className="rounded-2xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-5 shadow-xs sm:p-7"
            >
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-solid border-[var(--rd-border)] pb-4">
                <div>
                  <h2 className="m-0 text-base font-bold text-[var(--rd-text)] sm:text-lg">
                    Pengaturan Profil
                  </h2>
                  <p className="m-0 mt-0.5 text-xs text-[var(--rd-muted)]">
                    Perbarui identitas tampilan dan kontak aktif yang tercatat di
                    sistem.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Avatar Upload Section */}
                <div className="flex flex-wrap items-center gap-4 rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)]/50 p-4">
                  <div className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] text-[var(--rd-muted)] sm:size-20">
                    {loading ? (
                      <Skeleton className="size-full rounded-full" />
                    ) : avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={name || "Foto profil"}
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="grid size-9 place-items-center rounded-full border border-solid border-[var(--rd-border)] text-[var(--rd-muted)]">
                        <UserRound
                          size={20}
                          strokeWidth={1.7}
                          aria-hidden="true"
                        />
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="m-0 mb-2 text-xs font-semibold text-[var(--rd-text)] sm:text-sm">
                      Foto Profil
                    </p>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleSelectAvatar}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => fileInputRef.current?.click()}
                        className={`inline-flex min-h-9 items-center gap-2 rounded-lg bg-[var(--rd-primary)] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--rd-primary-hover)] disabled:cursor-not-allowed disabled:opacity-55 ${focusRing}`}
                      >
                        <Upload size={15} aria-hidden="true" />
                        <span>Upload image</span>
                      </button>

                      {avatarUrl && (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => setAvatarUrl(null)}
                          className={`${btnSecondary} !min-h-9 !px-3 !py-1.5 !text-xs text-[var(--rd-coral)]`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
                    <p className="m-0 mt-1.5 text-[11px] text-[var(--rd-muted)]">
                      Format JPG, PNG, atau WebP · Maksimal 2 MB.
                    </p>
                  </div>
                </div>

                {/* Editable Fields in 2-Column Grid on Desktop */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {/* Editable Field: Nama Lengkap */}
                  <div>
                    <label
                      htmlFor="profile-name"
                      className="mb-2 block text-xs font-semibold text-[var(--rd-text)] sm:text-sm"
                    >
                      Nama Lengkap
                    </label>
                    {loading ? (
                      <Skeleton className="h-11 w-full rounded-[10px]" />
                    ) : (
                      <input
                        id="profile-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Masukkan nama lengkap Anda"
                        className={`${fieldControl} !mt-0`}
                      />
                    )}
                    <p className="m-0 mt-1.5 text-xs leading-relaxed text-[var(--rd-muted)]">
                      Nama tampilan resmi pada laporan dan riwayat penanganan.
                    </p>
                  </div>

                  {/* Editable Field: Nomor Kontak Telepon */}
                  <div>
                    <label
                      htmlFor="profile-phone"
                      className="mb-2 block text-xs font-semibold text-[var(--rd-text)] sm:text-sm"
                    >
                      Nomor Kontak Telepon
                    </label>
                    {loading ? (
                      <Skeleton className="h-11 w-full rounded-[10px]" />
                    ) : (
                      <input
                        id="profile-phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Contoh: 0812-3456-7890"
                        className={`${fieldControl} !mt-0 font-mono`}
                      />
                    )}
                    <p className="m-0 mt-1.5 text-xs leading-relaxed text-[var(--rd-muted)]">
                      Nomor telepon atau WhatsApp aktif untuk koordinasi
                      lapangan.
                    </p>
                  </div>
                </div>

                {/* Divider for Non-Editable Fields */}
                <div className="border-t border-solid border-[var(--rd-border)] pt-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Lock
                      size={14}
                      className="shrink-0 text-[var(--rd-muted)]"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-semibold text-[var(--rd-muted)]">
                      Informasi Kepegawaian & Hak Akses (Tidak dapat diubah)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {/* NIP */}
                    <div>
                      <label
                        htmlFor="profile-nip"
                        className="mb-1.5 block text-xs font-semibold text-[var(--rd-text)]"
                      >
                        NIP (Nomor Induk Pegawai)
                      </label>
                      {loading ? (
                        <Skeleton className="h-10 w-full rounded-[10px]" />
                      ) : (
                        <input
                          id="profile-nip"
                          type="text"
                          disabled
                          readOnly
                          value={account?.nip || "-"}
                          className={`${readOnlyInput} font-mono`}
                        />
                      )}
                    </div>

                    {/* Unit Kerja */}
                    <div className="sm:col-span-1 lg:col-span-2">
                      <label
                        htmlFor="profile-unit"
                        className="mb-1.5 block text-xs font-semibold text-[var(--rd-text)]"
                      >
                        Unit Kerja / Divisi
                      </label>
                      {loading ? (
                        <Skeleton className="h-10 w-full rounded-[10px]" />
                      ) : (
                        <input
                          id="profile-unit"
                          type="text"
                          disabled
                          readOnly
                          value={account?.unit || "Operasional Bandara"}
                          className={readOnlyInput}
                        />
                      )}
                    </div>

                    {/* Peran Akses */}
                    <div>
                      <label
                        htmlFor="profile-role"
                        className="mb-1.5 block text-xs font-semibold text-[var(--rd-text)]"
                      >
                        Peran Akses
                      </label>
                      {loading ? (
                        <Skeleton className="h-10 w-full rounded-[10px]" />
                      ) : (
                        <input
                          id="profile-role"
                          type="text"
                          disabled
                          readOnly
                          value={roleLabels[role]}
                          className={readOnlyInput}
                        />
                      )}
                    </div>

                    {/* Status Akun */}
                    <div>
                      <label
                        htmlFor="profile-status"
                        className="mb-1.5 block text-xs font-semibold text-[var(--rd-text)]"
                      >
                        Status Akun
                      </label>
                      {loading ? (
                        <Skeleton className="h-10 w-full rounded-[10px]" />
                      ) : (
                        <input
                          id="profile-status"
                          type="text"
                          disabled
                          readOnly
                          value={
                            account?.status === "INACTIVE"
                              ? "Nonaktif"
                              : "Aktif"
                          }
                          className={readOnlyInput}
                        />
                      )}
                    </div>

                    {/* Terdaftar */}
                    <div>
                      <label
                        htmlFor="profile-created"
                        className="mb-1.5 block text-xs font-semibold text-[var(--rd-text)]"
                      >
                        Terdaftar
                      </label>
                      {loading ? (
                        <Skeleton className="h-10 w-full rounded-[10px]" />
                      ) : (
                        <input
                          id="profile-created"
                          type="text"
                          disabled
                          readOnly
                          value={
                            account?.createdAt
                              ? dateText(account.createdAt)
                              : "-"
                          }
                          className={readOnlyInput}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end border-t border-solid border-[var(--rd-border)] pt-4">
                  <button
                    type="submit"
                    disabled={loading || !user}
                    className={`${btnPrimary} !px-5 !py-2.5`}
                  >
                    <CheckCircle2 size={16} aria-hidden="true" />
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>

        <DashboardFooter />
      </main>
    </div>
  );
}
