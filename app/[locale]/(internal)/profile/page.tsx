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
  Check,
  ClipboardCheck,
  ClipboardClock,
  ClipboardPen,
  ClipboardX,
  FileSignature,
  IdCard,
  Loader2,
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
import { useTranslation } from "@/lib/i18n";
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
import {
  getProfileAction,
  updateProfileAction,
  type ProfileData,
} from "./_lib/profile.actions";
import {
  compressAvatarPhoto,
  processSignaturePhoto,
} from "../../_lib/signature-processor";

const readOnlyInput =
  "m-0 block w-full cursor-not-allowed rounded-[10px] border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)]/80 px-3.5 py-2.5 text-sm text-[var(--rd-muted)] opacity-85 select-all";

const PROFILE_CACHE_KEY = "perimeter_profile_cache";

interface ProfileCache {
  user: SessionUser;
  dbProfile: ProfileData | null;
  reports?: ReportRecord[];
  name: string;
  phone: string;
  avatarUrl: string | null;
  signatureUrl: string | null;
  updatedAt?: number;
}

function readProfileCache(): ProfileCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeProfileCache(cache: ProfileCache) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PROFILE_CACHE_KEY,
      JSON.stringify({ ...cache, updatedAt: Date.now() })
    );
  } catch {}
}

export default function ProfilePage() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale || "id";
  const { t } = useTranslation();
  const { theme, dark, toggleTheme } = useTheme();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [dbProfile, setDbProfile] = useState<ProfileData | null>(null);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPayload, setAvatarPayload] = useState<string | null | undefined>(
    undefined
  );

  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signaturePayload, setSignaturePayload] = useState<
    string | null | undefined
  >(undefined);
  const [processingSignature, setProcessingSignature] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const signatureInputRef = useRef<HTMLInputElement | null>(null);
  const isFormTouched = useRef(false);

  // Sync with local accounts store if available
  const accounts = useAccountsStore((state) => state.accounts);
  const updateStoreProfile = useAccountsStore((state) => state.updateProfile);

  useEffect(() => {
    let active = true;

    // Fast-hydrate from localStorage cache on client mount (avoids hydration mismatch)
    const cached = readProfileCache();
    if (cached) {
      if (cached.user) setUser(cached.user);
      if (cached.dbProfile) setDbProfile(cached.dbProfile);
      if (cached.reports) setReports(cached.reports);
      if (cached.name) setName(cached.name);
      if (cached.phone) setPhone(cached.phone);
      if (cached.avatarUrl) setAvatarUrl(cached.avatarUrl);
      if (cached.signatureUrl) setSignatureUrl(cached.signatureUrl);
      setLoading(false);
    }

    (async () => {
      try {
        const [session, reportItems, profileRes] = await Promise.all([
          api.getSession(),
          api.listReports(),
          getProfileAction(),
        ]);

        if (!active) return;

        if (!session) {
          if (typeof window !== "undefined") {
            try {
              window.localStorage.removeItem(PROFILE_CACHE_KEY);
            } catch {}
          }
          window.location.href = `/${locale}/login`;
          return;
        }

        setReports(reportItems);

        let finalName = cached?.name || session.name || "";
        let finalPhone = cached?.phone || session.phone || "";
        let finalAvatarUrl = cached?.avatarUrl ?? session.image ?? null;
        let finalSignatureUrl =
          cached?.signatureUrl ?? session.signatureUrl ?? null;
        let nextUser: SessionUser = session;
        let nextDbProfile: ProfileData | null = null;

        if (profileRes.success && profileRes.user) {
          const p = profileRes.user;
          nextUser = {
            ...session,
            name: p.name,
            phone: p.phone || undefined,
            unit: p.unit || undefined,
            image: p.image || undefined,
            signatureUrl: p.signatureUrl || undefined,
          };
          nextDbProfile = p;
          setUser(nextUser);
          setDbProfile(p);

          if (!isFormTouched.current) {
            setName(p.name);
            setPhone(p.phone || "");
            setAvatarUrl(p.image || null);
            setSignatureUrl(p.signatureUrl || null);
            finalName = p.name;
            finalPhone = p.phone || "";
            finalAvatarUrl = p.image || null;
            finalSignatureUrl = p.signatureUrl || null;
          }
        } else {
          // Fallback to session
          if (!isFormTouched.current) {
            setName(session.name);
            setPhone(session.phone || "");
            setAvatarUrl(session.image || null);
            setSignatureUrl(session.signatureUrl || null);
            finalName = session.name;
            finalPhone = session.phone || "";
            finalAvatarUrl = session.image || null;
            finalSignatureUrl = session.signatureUrl || null;
          }
        }

        if (!isFormTouched.current) {
          writeProfileCache({
            user: nextUser,
            dbProfile: nextDbProfile,
            name: finalName,
            phone: finalPhone,
            avatarUrl: finalAvatarUrl,
            signatureUrl: finalSignatureUrl,
            reports: reportItems,
          });
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

  // Autonomous Avatar handler (Zero-config, WebP < 30KB)
  async function handleSelectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Format foto tidak didukung. Gunakan JPG, PNG, atau WebP.");
      return;
    }

    try {
      toast.info("Mengompresi foto profil...");
      const { dataUrl } = await compressAvatarPhoto(file);
      isFormTouched.current = true;
      setAvatarUrl(dataUrl);
      setAvatarPayload(dataUrl);
      toast.success("Foto profil siap", {
        description: `Foto berhasil ter-upload. Simpan untuk menerapkan.`,
      });
    } catch (err) {
      toast.error(message(err) || "Gagal memproses foto profil.");
    }
  }

  function handleRemoveAvatar() {
    isFormTouched.current = true;
    setAvatarUrl(null);
    setAvatarPayload(null);
  }

  // Autonomous Wet Signature handler (Zero-config, transparent + auto-trim)
  async function handleSelectSignature(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Format foto tidak didukung. Gunakan JPG atau PNG.");
      return;
    }

    setProcessingSignature(true);
    try {
      toast.info("Memproses tanda tangan...");
      const { dataUrl } = await processSignaturePhoto(file);
      isFormTouched.current = true;
      setSignatureUrl(dataUrl);
      setSignaturePayload(dataUrl);
      toast.success("Tanda tangan berhasil diproses", {
        description: `Gambar berhasil diproses, pastikan hasil sudah sesuai.`,
      });
    } catch (err) {
      toast.error(
        message(err) ||
          "Gagal mengekstrak tanda tangan. Pastikan foto tanda tangan di atas kertas putih dan pencahayaan jelas."
      );
    } finally {
      setProcessingSignature(false);
    }
  }

  function handleRemoveSignature() {
    isFormTouched.current = true;
    setSignatureUrl(null);
    setSignaturePayload(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    const cleanedName = name.trim();
    const cleanedPhone = phone.trim();

    if (!cleanedName) {
      toast.error("Nama lengkap tidak boleh kosong.");
      return;
    }
    if (!cleanedPhone || cleanedPhone.length < 10 || cleanedPhone.length > 13) {
      toast.error("Nomor kontak telepon harus berupa angka antara 10 sampai 13 digit.");
      return;
    }

    setSaving(true);
    try {
      const res = await updateProfileAction({
        name: cleanedName,
        phone: cleanedPhone,
        avatarDataUrl: avatarPayload,
        signatureDataUrl: signaturePayload,
      });

      if (!res.success || !res.user) {
        throw new Error(res.errorMessage || "Gagal menyimpan perubahan profil.");
      }

      setDbProfile(res.user);
      setName(res.user.name);
      setPhone(res.user.phone || "");
      setAvatarUrl(res.user.image || null);
      setSignatureUrl(res.user.signatureUrl || null);
      setAvatarPayload(undefined);
      setSignaturePayload(undefined);
      isFormTouched.current = false;

      const nextUser: SessionUser = user
        ? {
            ...user,
            name: res.user.name,
            phone: res.user.phone || undefined,
            unit: res.user.unit || undefined,
            image: res.user.image || undefined,
            signatureUrl: res.user.signatureUrl || undefined,
          }
        : {
            id: res.user.id,
            name: res.user.name,
            email: res.user.email,
            role: res.user.role,
            phone: res.user.phone || undefined,
            unit: res.user.unit,
            image: res.user.image || undefined,
            signatureUrl: res.user.signatureUrl || undefined,
          };

      setUser(nextUser);

      writeProfileCache({
        user: nextUser,
        dbProfile: res.user,
        name: res.user.name,
        phone: res.user.phone || "",
        avatarUrl: res.user.image || null,
        signatureUrl: res.user.signatureUrl || null,
        reports,
      });

      // Sync local accounts store if available
      updateStoreProfile(nextUser.id, {
        name: res.user.name,
        phone: res.user.phone || "",
        avatarUrl: res.user.image || undefined,
      });

      toast.success("Profil berhasil diperbarui", {
        description: "Data berhasil tersimpan di sistem.",
      });
    } catch (err) {
      toast.error(message(err));
    } finally {
      setSaving(false);
    }
  }

  const role = dbProfile?.role || user?.role || "REPORTER";
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

  const displayName = name.trim() || dbProfile?.name || user?.name || "-";
  const displayUnit = dbProfile?.unit || user?.unit || "-";
  const displayNip = dbProfile?.nip || user?.nip || "-";
  const displayPhone = phone.trim() || dbProfile?.phone || user?.phone || "-";
  const isAccountActive = dbProfile?.status !== "INACTIVE";

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
        containerClassName="max-w-[1700px] min-[1100px]:px-[5%]"
      />

      <main
        suppressHydrationWarning
        className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col px-3 pt-4 md:px-[3%] md:pt-6 min-[1100px]:px-[5%]"
      >
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
            Perbarui foto profil, tanda tangan digital, nama tampilan, dan nomor
            kontak Anda.
          </p>
        </div>

        {/* 2-Column Desktop Layout */}
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
                      {t.header.roles[role] || roleLabels[role]}
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
                  {dbProfile?.createdAt ? dateText(dbProfile.createdAt) : "-"}
                </span>
              </li>
            </ul>
          </aside>

          {/* RIGHT COLUMN: Edit Profile Card + Signature Section */}
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
                    Perbarui identitas tampilan, foto profil, dan kontak aktif Anda.
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
                    <p className="m-0 mb-1 text-xs font-semibold text-[var(--rd-text)] sm:text-sm">
                      Foto Profil
                    </p>
                    <p className="m-0 mb-2.5 text-[11px] text-[var(--rd-muted)]">
                      Foto tersimpan
                    </p>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleSelectAvatar}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={loading || saving}
                        onClick={() => avatarInputRef.current?.click()}
                        className={`inline-flex min-h-9 items-center gap-2 rounded-lg bg-[var(--rd-primary)] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--rd-primary-hover)] disabled:cursor-not-allowed disabled:opacity-55 ${focusRing}`}
                      >
                        <Upload size={15} aria-hidden="true" />
                        <span>Upload foto</span>
                      </button>

                      {avatarUrl && (
                        <button
                          type="button"
                          disabled={loading || saving}
                          onClick={handleRemoveAvatar}
                          className={`${btnSecondary} !min-h-9 !px-3 !py-1.5 !text-xs text-[var(--rd-coral)]`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* SIGNATURE SECTION: ONLY FOR REPORTER AND TECHNICIAN (HIDDEN FOR OPERATOR) */}
                {!isOperator && (
                  <div className="rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)]/50 p-4 sm:p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileSignature
                          size={18}
                          className="text-[var(--rd-link)]"
                          aria-hidden="true"
                        />
                        <span className="text-xs font-semibold text-[var(--rd-text)] sm:text-sm">
                          Tanda Tangan Basah Digital
                        </span>
                      </div>
                    </div>

                    <p className="m-0 mb-3 text-xs leading-relaxed text-[var(--rd-muted)]">
                      Cukup kirimkan foto tanda tangan Anda berlatar kertas putih dan pencahayaan yang cukup.
                      Sistem akan otomatis melakukan proses penyesuaian gambar.
                    </p>

                    <input
                      ref={signatureInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleSelectSignature}
                      className="hidden"
                    />

                    {loading ? (
                      <div className="flex min-h-36 w-full items-center justify-center rounded-lg border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-4">
                        <Skeleton className="h-28 w-full rounded-md" />
                      </div>
                    ) : processingSignature ? (
                      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--rd-link)] bg-[var(--rd-surface)] py-8 text-center">
                        <Loader2
                          size={24}
                          className="animate-spin text-[var(--rd-link)]"
                        />
                        <span className="text-xs font-medium text-[var(--rd-text)]">
                          Sedang mengekstrak tanda tangan & membuang latar belakang...
                        </span>
                      </div>
                    ) : signatureUrl ? (
                      <div className="space-y-3">
                        {/* Signature Preview Canvas Box with subtle checkerboard pattern */}
                        <div
                          className="flex min-h-36 w-full items-center justify-center rounded-lg border border-solid border-[var(--rd-border)] p-4 shadow-inner"
                          style={{
                            backgroundColor: "#f8fafc",
                            backgroundImage:
                              "radial-gradient(#cbd5e1 0.75px, transparent 0.75px)",
                            backgroundSize: "8px 8px",
                          }}
                        >
                          <img
                            src={signatureUrl}
                            alt="Tanda Tangan Digital"
                            className="max-h-32 sm:max-h-36 max-w-full object-contain filter drop-shadow-sm"
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-0.5">
                            <Check className="text-[var(--rd-lime)]" size={14} aria-hidden="true"/>
                            <span className="text-[11px] font-medium text-[var(--rd-lime)]">
                              Tanda tangan sudah berhasil diproses, Simpan untuk menerapkan.
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={loading || saving}
                              onClick={() => signatureInputRef.current?.click()}
                              className={`${btnSecondary} !min-h-8 !px-3 !py-1 !text-xs`}
                            >
                              <Upload size={13} aria-hidden="true" />
                              <span>Ganti Foto</span>
                            </button>
                            <button
                              type="button"
                              disabled={loading || saving}
                              onClick={handleRemoveSignature}
                              className={`${btnSecondary} !min-h-8 !px-3 !py-1 !text-xs text-[var(--rd-coral)]`}
                            >
                              <Trash2 size={13} aria-hidden="true" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => signatureInputRef.current?.click()}
                        className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--rd-border)] bg-[var(--rd-surface)] px-4 py-6 text-center transition-colors hover:border-[var(--rd-link)] hover:bg-[var(--rd-link)]/5"
                      >
                        <div className="grid size-10 place-items-center rounded-full bg-[var(--rd-bg)] text-[var(--rd-link)] shadow-xs transition-transform group-hover:scale-105">
                          <Upload size={18} aria-hidden="true" />
                        </div>
                        <div>
                          <p className="m-0 text-xs font-semibold text-[var(--rd-text)]">
                            Unggah Foto Tanda Tangan
                          </p>
                          <p className="m-0 mt-0.5 text-[11px] text-[var(--rd-muted)]">
                            Ambil foto tanda tangan di kertas putih dengan pencahayaan yang baik.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
                        onChange={(e) => {
                          isFormTouched.current = true;
                          setName(e.target.value);
                        }}
                        placeholder="Masukkan nama lengkap Anda"
                        className={`${fieldControl} !mt-0`}
                      />
                    )}
                    <p className="m-0 mt-1.5 text-xs leading-relaxed text-[var(--rd-muted)]">
                      Nama tampilan resmi pada laporan dan lembar pengesahan.
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
                        maxLength={13}
                        value={phone}
                        onChange={(e) => {
                          isFormTouched.current = true;
                          setPhone(e.target.value.replace(/\D/g, "").slice(0, 13));
                        }}
                        placeholder="Contoh: 089999999999"
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
                          value={displayNip}
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
                          value={displayUnit}
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
                          value={t.header.roles[role] || roleLabels[role]}
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
                          value={isAccountActive ? "Aktif" : "Nonaktif"}
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
                            dbProfile?.createdAt
                              ? dateText(dbProfile.createdAt)
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
                    disabled={loading || saving || !user}
                    className={`${btnPrimary} !px-5 !py-2.5`}
                  >
                    {saving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} aria-hidden="true" />
                        <span>Simpan Perubahan</span>
                      </>
                    )}
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
