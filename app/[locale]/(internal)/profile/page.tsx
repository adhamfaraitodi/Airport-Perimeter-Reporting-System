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
import { Lock, Trash2, Upload, UserRound } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type SessionUser } from "../../_lib/client-api";
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

export default function ProfilePage() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale || "id";
  const { theme, dark, toggleTheme } = useTheme();

  const [user, setUser] = useState<SessionUser | null>(null);
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
        const session = await api.getSession();
        if (active) setUser(session);
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

  const homeLabel = isOperator
    ? "Dashboard"
    : isTechnician
      ? "Dashboard"
      : "Dashboard";

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
        containerClassName={
          isOperator || isTechnician
            ? "max-w-[1700px] min-[1100px]:px-[5%]"
            : "max-w-5xl"
        }
      />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-10 sm:px-8 sm:pt-8">
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
        <div className="mb-6">
          <h1 className="m-0 mb-1.5 text-xl leading-tight font-normal sm:text-3xl">
            Profil Saya,
          </h1>
          <p className="m-0 text-xs text-[var(--rd-muted)] sm:text-sm">
            Perbarui foto profil, nama tampilan, dan nomor kontak telepon Anda.
          </p>
        </div>

        {/* Profile Form Card (Shadcn style) */}
        <section
          aria-label="Pengaturan Profil Pengguna"
          className="rounded-2xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-5 shadow-xs sm:p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Avatar Upload Section */}
            <div className="flex flex-wrap items-center gap-5">
              <div className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] text-[var(--rd-muted)] sm:size-24">
                {loading ? (
                  <Skeleton className="size-full rounded-full" />
                ) : avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={name || "Foto profil"}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="grid size-10 place-items-center rounded-full border border-solid border-[var(--rd-border)] text-[var(--rd-muted)]">
                    <UserRound size={22} strokeWidth={1.7} aria-hidden="true" />
                  </span>
                )}
              </div>

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
                  className={`inline-flex min-h-9 items-center gap-2 rounded-lg bg-[var(--rd-primary)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--rd-primary-hover)] disabled:cursor-not-allowed disabled:opacity-55 sm:text-sm ${focusRing}`}
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
            </div>

            {/* Editable Field: Nama Lengkap */}
            <div>
              <label
                htmlFor="profile-name"
                className="mb-2 block text-xs font-semibold text-[var(--rd-text)] sm:text-sm"
              >
                Nama Lengkap
              </label>
              {loading ? (
                <Skeleton className="h-10 w-full rounded-[10px]" />
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
              <p className="m-0 mt-2 text-xs leading-relaxed text-[var(--rd-muted)]">
                Nama tampilan resmi yang tercatat pada laporan dan riwayat
                penanganan perimeter bandara.
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
                <Skeleton className="h-10 w-full rounded-[10px]" />
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
              <p className="m-0 mt-2 text-xs leading-relaxed text-[var(--rd-muted)]">
                Nomor telepon atau WhatsApp aktif yang digunakan untuk koordinasi
                cepat petugas di lapangan.
              </p>
            </div>

            {/* Divider for Non-Editable Fields */}
            <div className="border-t border-solid border-[var(--rd-border)] pt-6">
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

              <div className="space-y-5">
                {/* NIP */}
                <div>
                  <label
                    htmlFor="profile-nip"
                    className="mb-2 block text-xs font-semibold text-[var(--rd-text)] sm:text-sm"
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
                  <p className="m-0 mt-1.5 text-xs text-[var(--rd-muted)]">
                    Nomor identitas kepegawaian resmi yang terdaftar pada sistem.
                  </p>
                </div>

                {/* Unit Kerja */}
                <div>
                  <label
                    htmlFor="profile-unit"
                    className="mb-2 block text-xs font-semibold text-[var(--rd-text)] sm:text-sm"
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

                {/* Peran Akses, Status, Terdaftar */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="profile-role"
                      className="mb-2 block text-xs font-semibold text-[var(--rd-text)] sm:text-sm"
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

                  <div>
                    <label
                      htmlFor="profile-status"
                      className="mb-2 block text-xs font-semibold text-[var(--rd-text)] sm:text-sm"
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
                          account?.status === "INACTIVE" ? "Nonaktif" : "Aktif"
                        }
                        className={readOnlyInput}
                      />
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="profile-created"
                      className="mb-2 block text-xs font-semibold text-[var(--rd-text)] sm:text-sm"
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
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !user}
                className={`${btnPrimary} !px-5 !py-2.5`}
              >
                Update profile
              </button>
            </div>
          </form>
        </section>

        <DashboardFooter />
      </main>
    </div>
  );
}
