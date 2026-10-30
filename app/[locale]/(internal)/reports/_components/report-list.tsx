"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CalendarArrowDown,
  CalendarArrowUp,
  CheckCircle2,
  ClipboardList,
  ClipboardClock,
  ClipboardPen,
  ClipboardCheck,
  ClipboardX,
  Images,
  MapPin,
  Plus,
  RefreshCw,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportRecord, SessionUser } from "../../../_lib/client-api";
import { useTheme } from "../../../_lib/use-theme";
import { AppHeader } from "../../../_components/app-header";
import { ReportFooter } from "./report-footer";

const filters = [
  ["ALL", "Semua"],
  ["OPEN", "Baru"],
  ["IN_PROGRESS", "Ditangani"],
  ["RESOLVED", "Selesai"],
  ["CLOSED", "Ditutup"],
] as const;

const states: Record<
  string,
  { icon: typeof ClipboardList; label: string }
> = {
  ALL: { icon: ClipboardList, label: "Total laporan" },
  OPEN: { icon: ClipboardClock, label: "Baru" },
  IN_PROGRESS: { icon: ClipboardPen, label: "Ditangani" },
  RESOLVED: { icon: ClipboardCheck, label: "Selesai" },
  CLOSED: { icon: ClipboardX, label: "Ditutup" },
};

const button =
  "border-0 font-normal focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--rd-link)] disabled:cursor-not-allowed disabled:opacity-55";

const dateFormat = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

function dateLabel(value?: string | null) {
  if (!value) return "Tanggal tidak tersedia";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Tanggal tidak tersedia"
    : `${dateFormat.format(date)} WIB`;
}

function StateIcon({ status, size = 24 }: { status: string; size?: number }) {
  const Icon = (states[status] || states.OPEN).icon;
  return (
    <span
      data-status={status}
      className="rd-status flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--rd-tint)] text-[var(--rd-status)]"
    >
      <Icon size={size} strokeWidth={1.9} aria-hidden="true" />
    </span>
  );
}

function ReportCard({
  report,
  onSelect,
}: {
  report: ReportRecord;
  onSelect: (id: string) => void;
}) {
  const status = report.deletedAt ? "CLOSED" : report.status;
  const state = states[status] || states.OPEN;
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const chips = findings
    .flatMap((f) => [
      f.partName,
      ...(Array.isArray(f.damages)
        ? f.damages.map((d) => (typeof d === "string" ? d : d.name))
        : []),
    ])
    .filter((value): value is string => typeof value === "string" && !!value.trim());

  return (
    <button
      type="button"
      onClick={() => onSelect(report.id)}
      className={`${button} flex w-full items-start gap-3 rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-3 text-left text-[var(--rd-text)] transition-colors hover:bg-[var(--rd-hover)] sm:p-4`}
      aria-label={`Buka laporan ${report.id}, ${state.label}`}
    >
      <span className="pt-0.5">
        <StateIcon status={states[status] ? status : "OPEN"} size={23} />
      </span>
      <span className="block min-w-0 flex-1">
        <span className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-xs">
          <span className="text-[var(--rd-muted)]">
            #{String(report.id).slice(-6).toUpperCase()}
          </span>
          <span
            data-status={status}
            className="rd-status inline-flex items-center gap-1 rounded-full bg-[var(--rd-tint)] px-1.5 py-0.5 text-[var(--rd-status)]"
          >
            <span className="size-1.5 rounded-full bg-current" />
            {state.label}
          </span>
          <time
            dateTime={report.createdAt}
            className="text-[9px] text-[var(--rd-muted)] sm:ml-auto sm:text-[11px]"
          >
            {dateLabel(report.createdAt)}
          </time>
        </span>
        {chips.length ? (
          <span className="mb-1 flex flex-wrap gap-1">
            {chips.map((label, index) => (
              <span
                key={`${label}-${index}`}
                className="rounded-md bg-[var(--rd-active)] px-1.5 py-0.5 text-xs text-[var(--rd-link)]"
              >
                {label}
              </span>
            ))}
          </span>
        ) : (
          <span className="mb-1 block text-sm">
            {report.side
              ? `Perimeter sisi ${report.side}`
              : "Laporan temuan perimeter"}
          </span>
        )}
        <span className="mt-1 block truncate text-xs leading-relaxed text-[var(--rd-muted)] sm:text-sm">
          {report.narrative}
        </span>
        <span className="mt-3 flex flex-wrap gap-x-5 gap-y-2 pt-3 text-[10px] sm:text-xs">
          <span className="inline-flex items-center gap-1.5">
            <Images
              size={15}
              className="text-[var(--rd-link)]"
              aria-hidden="true"
            />
            {report.images?.length || 0} Gambar
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin
              size={15}
              className="text-[var(--rd-link)]"
              aria-hidden="true"
            />
            {report.segmentCode
              ? `Segmen ${report.segmentCode}`
              : "Segmen belum dipetakan"}
          </span>
        </span>
      </span>
    </button>
  );
}

export interface ReporterDashboardProps {
  user?: SessionUser | null;
  reports: ReportRecord[];
  loading: boolean;
  error: string;
  notice: string;
  filter: string;
  onFilter: (filter: string) => void;
  onRefresh: () => void;
  onCreate: () => void;
  onSelect: (id: string) => void;
  selectedReportId?: string | null;
  onBackToList?: () => void;
  abandonedSubmissionId: string | null;
  onDismissAbandoned: () => void;
  children?: ReactNode;
  formOpen?: boolean;
}

export function ReportList({
  user,
  reports,
  loading,
  error,
  notice,
  filter,
  onFilter,
  onRefresh,
  onCreate,
  onSelect,
  selectedReportId,
  onBackToList,
  abandonedSubmissionId,
  onDismissAbandoned,
  children,
  formOpen = false,
}: ReporterDashboardProps) {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale || "id";
  const { theme, dark, toggleTheme } = useTheme();
  const [newest, setNewest] = useState(true);

  const owned = user
    ? reports.filter((report) => report.reporterId === user.id)
    : [];
  const visible = owned
    .filter(
      (r) =>
        filter === "ALL" ||
        (filter === "CLOSED"
          ? !!r.deletedAt
          : !r.deletedAt && r.status === filter)
    )
    .sort(
      (a, b) =>
        (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) *
        (newest ? 1 : -1)
    );

  const stats: Array<[string, number, string, string]> = [
    [
      "ALL",
      owned.length,
      "Total laporan",
      "Seluruh laporan yang telah dikirim",
    ],
    [
      "OPEN",
      owned.filter(
        (r) => !r.deletedAt && ["OPEN", "IN_PROGRESS"].includes(r.status)
      ).length,
      "Perlu Tindak Lanjut",
      "Laporan baru & sedang ditangani",
    ],
    [
      "RESOLVED",
      owned.filter((r) => !r.deletedAt && r.status === "RESOLVED").length,
      "Selesai",
      "Penanganan perimeter tuntas",
    ],
  ];

  const SortIcon = newest ? CalendarArrowDown : CalendarArrowUp;
  const subPageLabel = formOpen
    ? "Buat Laporan"
    : selectedReportId
      ? `Detail Laporan #${String(selectedReportId).slice(-6).toUpperCase()}`
      : null;

  return (
    <div
      className="reporter-dashboard flex min-h-dvh flex-col bg-[var(--rd-bg)] text-[var(--rd-text)]"
      data-theme={theme}
    >
      <AppHeader
        user={user}
        dark={dark}
        onToggleTheme={toggleTheme}
        roleLabel="Reporter perimeter"
        containerClassName="max-w-[1700px] min-[1100px]:px-[5%]"
      />
      <main className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col px-3 pt-4 pb-6 md:px-[3%] md:pt-6 min-[1100px]:px-[5%]">
        <nav
          aria-label="Breadcrumb"
          className="mb-3 flex flex-wrap items-center gap-2 text-xs md:text-[13px]"
        >
          <span className="text-[var(--rd-muted)]">Dashboard</span>
          <span className="text-[var(--rd-muted)]/50 select-none">/</span>
          {subPageLabel ? (
            <>
              <button
                type="button"
                onClick={onBackToList}
                className="border-0 bg-transparent p-0 text-[var(--rd-muted)] transition-colors hover:text-[var(--rd-link)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)]"
              >
                Laporan Saya
              </button>
              <span className="text-[var(--rd-muted)]/50 select-none">/</span>
              <span className="font-medium text-[var(--rd-link)]">
                {subPageLabel}
              </span>
            </>
          ) : (
            <span className="font-medium text-[var(--rd-link)]">
              Laporan Saya
            </span>
          )}
        </nav>

        <div className="mb-[18px] sm:flex sm:items-end sm:justify-between sm:gap-10 md:mb-[26px]">
          <div>
            <h1 className="m-0 mb-2 text-xl leading-tight font-normal tracking-normal sm:text-3xl">
              Laporan Saya,
            </h1>
            <p className="m-0 max-w-md text-xs leading-snug text-[var(--rd-muted)] sm:text-sm">
              Mulai laporkan kerusakan atau kejadian pelanggaran pembatas
              perimeter bandara.
            </p>
          </div>
          <div className="mt-4 flex gap-[14px] sm:mt-0 sm:w-80 sm:shrink-0">
            <button
              type="button"
              disabled={loading || !!error || formOpen || !user}
              onClick={onCreate}
              className={`${button} flex min-h-10 flex-1 items-center justify-center gap-1 rounded-[10px] bg-[var(--rd-primary)] px-3 py-2 text-sm font-bold text-white hover:bg-[var(--rd-primary-hover)]`}
            >
              <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
              Buat Laporan
            </button>
            <button
              type="button"
              disabled={loading || formOpen}
              onClick={onRefresh}
              aria-label="Segarkan laporan"
              title="Segarkan laporan"
              className={`${button} grid min-h-10 w-12 place-items-center rounded-[10px] border-2 border-solid border-[var(--rd-primary)] bg-[var(--rd-active)] p-0 text-[var(--rd-link)]`}
            >
              <RefreshCw
                size={21}
                className={
                  loading ? "animate-spin motion-reduce:animate-none" : ""
                }
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        {notice && (
          <p
            role="status"
            className="mb-5 rounded-lg bg-[var(--rd-active)] p-3 text-sm text-[var(--rd-link)]"
          >
            {notice}
          </p>
        )}
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-[var(--rd-border)] bg-[var(--rd-surface)] p-4 text-sm text-[var(--rd-coral)]"
          >
            {error}
            <p className="m-0 mt-1 text-xs">
              Gunakan tombol segarkan untuk mencoba kembali.
            </p>
          </div>
        )}
        {abandonedSubmissionId && (
          <div
            role="status"
            className="mb-5 rounded-lg border border-[var(--rd-border)] p-3 text-xs leading-relaxed"
          >
            <strong>Pengiriman sebelumnya belum pasti.</strong>
            <p className="my-2 break-all">
              Transaksi {abandonedSubmissionId}. Periksa laporan sebelum
              mengirim ulang; meninggalkan form tidak membatalkan transaksi
              server.
            </p>
            <button
              type="button"
              onClick={onDismissAbandoned}
              className={`${button} rounded-lg bg-[var(--rd-active)] px-3 py-1.5 text-[var(--rd-link)]`}
            >
              Saya sudah memeriksa
            </button>
          </div>
        )}

        {children ? (
          <div>{children}</div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[350px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)] xl:gap-6">
            {/* LEFT SIDEBAR: Summary Stats & Field Reporter Guide */}
            <aside className="space-y-5 lg:sticky lg:top-6">
              <section
                aria-label="Ringkasan laporan"
                className="grid grid-cols-3 gap-2.5 sm:gap-4 lg:grid-cols-1 lg:gap-3 lg:rounded-2xl lg:border-2 lg:border-[var(--rd-border)] lg:bg-[var(--rd-surface)] lg:p-5"
              >
                <div className="hidden lg:block lg:pb-1">
                  <h2 className="m-0 text-base font-normal text-[var(--rd-text)]">
                    Ringkasan Laporan
                  </h2>
                  <p className="m-0 mt-0.5 text-xs text-[var(--rd-muted)]">
                    Rekapitulasi status laporan Anda saat ini
                  </p>
                </div>
                {stats.map(([status, count, label, desc]) => (
                  <div
                    key={status}
                    className="rounded-xl border-2 border-[var(--rd-border)] bg-[var(--rd-surface)] px-2 py-2.5 sm:flex sm:items-center sm:gap-3.5 sm:p-4 lg:border lg:bg-[var(--rd-bg)]/50 lg:px-4 lg:py-3.5"
                    title={
                      status === "OPEN"
                        ? "Laporan baru dan sedang ditangani, tidak termasuk laporan ditutup"
                        : label
                    }
                  >
                    <StateIcon status={status} />
                    <div className="min-w-0 flex-1">
                      <span className="mt-2 block text-[10px] min-[390px]:text-[11px] sm:mt-0 sm:text-xs lg:font-semibold">
                        {label}
                      </span>
                      <span className="hidden text-[11px] text-[var(--rd-muted)] lg:block">
                        {desc}
                      </span>
                    </div>
                    {loading ? (
                      <Skeleton className="mt-2 h-7 w-10 rounded-md sm:mt-0 sm:h-8 sm:w-10" />
                    ) : (
                      <span className="mt-2 block px-1 text-xl leading-tight sm:mt-0 sm:text-2xl lg:font-bold">
                        {count}
                      </span>
                    )}
                  </div>
                ))}
              </section>

              {/* Desktop Field Guidelines & Reporter Card */}
              <section
                aria-label="Panduan Pelaporan Lapangan"
                className="hidden rounded-2xl border-2 border-[var(--rd-border)] bg-[var(--rd-surface)] p-5 lg:block"
              >
                <div className="mb-4 flex items-center gap-3 border-b border-[var(--rd-border)] pb-3.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--rd-active)] text-[var(--rd-link)]">
                    <UserRound size={20} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-sm font-bold text-[var(--rd-text)]">
                      {user?.name || "Petugas Pelapor"}
                    </p>
                    <p className="m-0 text-xs text-[var(--rd-muted)]">
                      Yogyakarta International Airport
                    </p>
                  </div>
                  <Link
                    href={`/${locale}/profile`}
                    className="rounded-lg border border-[var(--rd-border)] bg-[var(--rd-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--rd-link)] transition-colors hover:bg-[var(--rd-active)]"
                  >
                    Profil
                  </Link>
                </div>

                <h3 className="m-0 mb-3 flex items-center gap-1.5 text-xs font-bold tracking-wide text-[var(--rd-muted)] uppercase">
                  <ShieldAlert size={14} className="text-[var(--rd-link)]" aria-hidden="true" />
                  <span>Panduan Pelaporan</span>
                </h3>
                <ul className="m-0 list-none space-y-2.5 p-0 text-xs leading-relaxed text-[var(--rd-muted)]">
                  <li className="flex items-start gap-2">
                    <CheckCircle2
                      size={14}
                      className="mt-0.5 shrink-0 text-[var(--rd-link)]"
                      aria-hidden="true"
                    />
                    <span>
                      Lampirkan foto bukti kerusakan pagar yang jelas (maksimal 8
                      foto, maks 3 MB/foto).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2
                      size={14}
                      className="mt-0.5 shrink-0 text-[var(--rd-link)]"
                      aria-hidden="true"
                    />
                    <span>
                      Pastikan pin lokasi GPS pada peta sesuai dengan segmen
                      pagar perimeter yang diperiksa.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2
                      size={14}
                      className="mt-0.5 shrink-0 text-[var(--rd-link)]"
                      aria-hidden="true"
                    />
                    <span>
                      Pilih bagian pagar serta tingkat kerusakan secara spesifik
                      untuk mempercepat tindak lanjut teknisi.
                    </span>
                  </li>
                </ul>
              </section>
            </aside>

            {/* RIGHT MAIN AREA: Report History List */}
            <section
              aria-labelledby="report-history-title"
              aria-busy={loading}
              className="min-h-[315px] min-w-0 rounded-2xl border-2 border-[var(--rd-border)] bg-[var(--rd-surface)] p-3.5 sm:min-h-[420px] sm:p-6"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2
                  id="report-history-title"
                  className="m-0 text-base leading-normal font-normal tracking-normal sm:text-lg"
                >
                  Riwayat Laporan
                </h2>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-[var(--rd-border)] pb-3">
                <div
                  role="group"
                  aria-label="Filter status laporan"
                  className="flex gap-1 overflow-x-auto sm:gap-2"
                >
                  {filters.map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={filter === value}
                      onClick={() => onFilter(value)}
                      className={`${button} min-h-9 shrink-0 rounded-xl px-2 py-1 text-[11px] sm:px-4 sm:text-sm ${
                        filter === value
                          ? "bg-[var(--rd-active)] text-[var(--rd-link)]"
                          : "bg-transparent text-[var(--rd-muted)] hover:bg-[var(--rd-hover)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setNewest((value) => !value)}
                  aria-label={
                    newest
                      ? "Urutan terbaru dahulu. Ubah ke terlama dahulu"
                      : "Urutan terlama dahulu. Ubah ke terbaru dahulu"
                  }
                  title={newest ? "Terbaru → terlama" : "Terlama → terbaru"}
                  className={`${button} grid size-10 min-h-10 shrink-0 place-items-center rounded-lg bg-transparent p-0 text-[var(--rd-link)] hover:bg-[var(--rd-active)]`}
                >
                  <SortIcon size={21} aria-hidden="true" />
                </button>
              </div>
              <div role="status" className="my-3 text-xs text-[var(--rd-muted)]">
                {loading ? (
                  <Skeleton className="h-4 w-32 rounded-md" />
                ) : (
                  `${visible.length} laporan ditemukan`
                )}
              </div>
              {loading ? (
                <div className="grid gap-3">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      className="flex w-full items-start gap-3 rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-3 sm:p-4"
                    >
                      <Skeleton className="mt-0.5 size-8 shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1 space-y-2.5">
                        <div className="flex flex-wrap items-center gap-3">
                          <Skeleton className="h-4 w-16 rounded" />
                          <Skeleton className="h-5 w-20 rounded-full" />
                          <Skeleton className="ml-auto h-3.5 w-28 rounded" />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Skeleton className="h-5 w-36 rounded-md" />
                          <Skeleton className="h-5 w-28 rounded-md" />
                        </div>
                        <Skeleton className="h-4 w-4/5 rounded" />
                        <div className="flex gap-5 pt-2">
                          <Skeleton className="h-3.5 w-20 rounded" />
                          <Skeleton className="h-3.5 w-28 rounded" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-3">
                  {visible.map((report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              )}
              {!visible.length && !loading && (
                <div className="flex min-h-40 items-center justify-center px-3 text-center text-base text-[var(--rd-muted)]">
                  {error
                    ? "Daftar laporan belum dapat dimuat"
                    : filter === "ALL"
                      ? "Belum ada laporan"
                      : "Belum ada laporan dengan status ini"}
                </div>
              )}
            </section>
          </div>
        )}
        <ReportFooter />
      </main>
    </div>
  );
}
