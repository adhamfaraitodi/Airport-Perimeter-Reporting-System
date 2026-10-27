"use client";

import { useState, type ReactNode } from "react";
import {
  CalendarArrowDown,
  CalendarArrowUp,
  ClipboardList,
  ClipboardClock,
  ClipboardPen,
  ClipboardCheck,
  ClipboardX,
  Images,
  MapPin,
  Plus,
  RefreshCw,
} from "lucide-react";
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
      className={`${button} flex w-full items-start gap-3 rounded-lg border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-3 text-left text-[var(--rd-text)] transition-colors hover:bg-[var(--rd-hover)] sm:p-4`}
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
  user: SessionUser;
  reports: ReportRecord[];
  loading: boolean;
  error: string;
  notice: string;
  filter: string;
  onFilter: (filter: string) => void;
  onRefresh: () => void;
  onCreate: () => void;
  onSelect: (id: string) => void;
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
  abandonedSubmissionId,
  onDismissAbandoned,
  children,
  formOpen = false,
}: ReporterDashboardProps) {
  const { theme, dark, toggleTheme } = useTheme();
  const [newest, setNewest] = useState(true);

  const owned = reports.filter((report) => report.reporterId === user.id);
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

  const stats: Array<[string, number, string]> = [
    ["ALL", owned.length, "Total laporan"],
    [
      "OPEN",
      owned.filter(
        (r) => !r.deletedAt && ["OPEN", "IN_PROGRESS"].includes(r.status)
      ).length,
      "Perlu Tindak Lanjut",
    ],
    [
      "RESOLVED",
      owned.filter((r) => !r.deletedAt && r.status === "RESOLVED").length,
      "Selesai",
    ],
  ];

  const SortIcon = newest ? CalendarArrowDown : CalendarArrowUp;

  return (
    <div
      className="reporter-dashboard min-h-dvh bg-[var(--rd-bg)] text-[var(--rd-text)]"
      data-theme={theme}
    >
      <AppHeader
        user={user}
        dark={dark}
        onToggleTheme={toggleTheme}
        containerClassName="max-w-5xl"
      />
      <main className="mx-auto max-w-5xl px-[26px] pt-11 pb-6 sm:px-8 sm:pt-12">
        <div className="sm:flex sm:items-end sm:justify-between sm:gap-10">
          <div>
            <h1 className="m-0 mb-2 text-xl leading-tight font-normal tracking-normal sm:text-3xl">
              Laporan Saya,
            </h1>
            <p className="m-0 max-w-sm text-xs leading-snug sm:text-sm">
              Mulai laporkan kerusakan atau kejadian pelanggaran pembatas
              perimeter bandara.
            </p>
          </div>
          <div className="mt-5 flex gap-[14px] sm:mt-0 sm:w-80 sm:shrink-0">
            <button
              type="button"
              disabled={loading || !!error || formOpen}
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
            className="mt-5 rounded-lg bg-[var(--rd-active)] p-3 text-sm text-[var(--rd-link)]"
          >
            {notice}
          </p>
        )}
        {error && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-[var(--rd-border)] bg-[var(--rd-surface)] p-4 text-sm text-[var(--rd-coral)]"
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
            className="mt-5 rounded-lg border border-[var(--rd-border)] p-3 text-xs leading-relaxed"
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
          <div className="mt-6">{children}</div>
        ) : (
          <>
            <section
              aria-label="Ringkasan laporan"
              className="mt-6 grid grid-cols-3 gap-2.5 sm:gap-5"
            >
              {stats.map(([status, count, label]) => (
                <div
                  key={status}
                  className="rounded-xl border-2 border-[var(--rd-border)] bg-[var(--rd-surface)] px-2 py-2.5 sm:flex sm:items-center sm:gap-4 sm:p-5"
                  title={
                    status === "OPEN"
                      ? "Laporan baru dan sedang ditangani, tidak termasuk laporan ditutup"
                      : label
                  }
                >
                  <StateIcon status={status} />
                  <div>
                    <span className="mt-2 block px-1 text-xl leading-tight sm:mt-0 sm:text-3xl">
                      {count}
                    </span>
                    <span className="mt-2 block text-[10px] min-[390px]:text-[11px] sm:text-sm">
                      {label}
                    </span>
                  </div>
                </div>
              ))}
            </section>
            <section
              aria-labelledby="report-history-title"
              aria-busy={loading}
              className="mt-6 min-h-[315px] rounded-xl border-2 border-[var(--rd-border)] bg-[var(--rd-surface)] p-3.5 sm:mt-8 sm:min-h-[360px] sm:p-6"
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
              <p role="status" className="my-3 text-xs text-[var(--rd-muted)]">
                {loading
                  ? "Memuat laporan…"
                  : `${visible.length} laporan ditemukan`}
              </p>
              <div className="grid gap-3">
                {visible.map((report) => (
                  <ReportCard
                    key={report.id}
                    report={report}
                    onSelect={onSelect}
                  />
                ))}
              </div>
              {!visible.length && (
                <div className="flex min-h-40 items-center justify-center px-3 text-center text-base text-[var(--rd-muted)]">
                  {loading
                    ? "Memuat laporan…"
                    : error
                      ? "Daftar laporan belum dapat dimuat"
                      : filter === "ALL"
                        ? "Belum ada laporan"
                        : "Belum ada laporan dengan status ini"}
                </div>
              )}
            </section>
          </>
        )}
        <ReportFooter/>
      </main>
    </div>
  );
}
