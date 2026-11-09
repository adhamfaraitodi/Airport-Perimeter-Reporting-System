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
import { ReportHistoryPanel } from "../../../_components/report-history-panel";
import { useTranslation } from "@/lib/i18n";

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
  const { t } = useTranslation();

  const owned = user
    ? reports.filter(
        (report) =>
          user.role === "OPERATOR" ||
          report.reporterId === user.id ||
          report.reporterId === "demo-reporter"
      )
    : [];

  const stats: Array<[string, number, string, string]> = [
    [
      "ALL",
      owned.length,
      t.status.totalReports,
      locale === "en" ? "All submitted reports" : "Seluruh laporan yang telah dikirim",
    ],
    [
      "OPEN",
      owned.filter(
        (r) => !r.deletedAt && ["OPEN", "IN_PROGRESS"].includes(r.status)
      ).length,
      t.status.followUpRequired,
      locale === "en" ? "New & in-progress reports" : "Laporan baru & sedang ditangani",
    ],
    [
      "RESOLVED",
      owned.filter((r) => !r.deletedAt && r.status === "RESOLVED").length,
      t.status.RESOLVED,
      locale === "en" ? "Repaired by technicians" : "Telah diperbaiki oleh teknisi",
    ],
  ];

  const subPageLabel = formOpen
    ? t.reports.createReport
    : selectedReportId
      ? `${locale === "en" ? "Report Detail" : "Detail Laporan"} #${String(selectedReportId).slice(-6).toUpperCase()}`
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
        containerClassName="max-w-[1700px] min-[1100px]:px-[5%]"
      />

      <main className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col px-3 pt-4 md:px-[3%] md:pt-6 min-[1100px]:px-[5%]">
        {/* Breadcrumb Navigation */}
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
                {t.reports.title}
              </button>
              <span className="text-[var(--rd-muted)]/50 select-none">/</span>
              <span className="font-medium text-[var(--rd-link)]">
                {subPageLabel}
              </span>
            </>
          ) : (
            <span className="font-medium text-[var(--rd-link)]">
              {t.reports.title}
            </span>
          )}
        </nav>

        {/* Top Header Section with Actions */}
        <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="m-0 text-xl font-normal tracking-tight sm:text-2xl">
              {t.reports.title}
            </h1>
            <p className="m-0 mt-1 text-xs text-[var(--rd-muted)] sm:text-sm">
              {locale === "en"
                ? "Report perimeter fence damage or airport boundary security incidents."
                : "Mulai laporkan kerusakan atau kejadian pelanggaran pembatas perimeter bandara."}
            </p>
          </div>
          <div className="flex w-full gap-4 sm:w-auto sm:shrink-0">
            <button
              type="button"
              disabled={loading || !!error || formOpen || !user}
              onClick={onCreate}
              className={`${button} flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[var(--rd-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--rd-primary-hover)] sm:flex-none sm:text-sm`}
            >
              <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
              {t.reports.createReport}
            </button>

            <button
              type="button"
              disabled={loading || formOpen}
              onClick={onRefresh}
              aria-label={t.common.refresh}
              title={t.common.refresh}
              className={`${button} grid min-h-10 w-11 shrink-0 place-items-center rounded-[10px] border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-0 text-[var(--rd-link)] hover:bg-[var(--rd-hover)]`}
            >
              <RefreshCw
                size={18}
                className={loading ? "animate-spin motion-reduce:animate-none" : ""}
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
              {locale === "en" ? "Use the refresh button to try again." : "Gunakan tombol segarkan untuk mencoba kembali."}
            </p>
          </div>
        )}
        {abandonedSubmissionId && (
          <div
            role="status"
            className="mb-5 rounded-lg border border-[var(--rd-border)] p-3 text-xs leading-relaxed"
          >
            <strong>{locale === "en" ? "Previous submission pending confirmation." : "Pengiriman sebelumnya belum pasti."}</strong>
            <p className="my-2 break-all">
              {locale === "en"
                ? `Transaction ${abandonedSubmissionId}. Check report before resubmitting; leaving form does not cancel server transaction.`
                : `Transaksi ${abandonedSubmissionId}. Periksa laporan sebelum mengirim ulang; meninggalkan form tidak membatalkan transaksi server.`}
            </p>
            <button
              type="button"
              onClick={onDismissAbandoned}
              className={`${button} rounded-lg bg-[var(--rd-active)] px-3 py-1.5 text-[var(--rd-link)]`}
            >
              {locale === "en" ? "I have checked" : "Saya sudah memeriksa"}
            </button>
          </div>
        )}

        {children ? (
          <div className="w-full">{children}</div>
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
                    {t.operator.summaryTitle}
                  </h2>
                  <p className="m-0 mt-0.5 text-xs text-[var(--rd-muted)]">
                    {locale === "en" ? "Summary of your current reports status" : "Rekapitulasi status laporan Anda saat ini"}
                  </p>
                </div>
                {stats.map(([status, count, label, desc]) => (
                  <div
                    key={status}
                    className="rounded-xl border-2 border-[var(--rd-border)] bg-[var(--rd-surface)] px-2 py-2.5 sm:flex sm:items-center sm:gap-3.5 sm:p-4 lg:border lg:bg-[var(--rd-bg)]/50 lg:px-4 lg:py-3.5"
                    title={
                      status === "OPEN"
                        ? locale === "en" ? "New and ongoing reports, excluding closed" : "Laporan baru dan sedang ditangani, tidak termasuk laporan ditutup"
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
                      <Skeleton className="mt-2 h-[25px] w-10 rounded-md sm:mt-0 sm:h-[30px] sm:w-10" />
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
                      {user?.name || (locale === "en" ? "Field Reporter" : "Petugas Pelapor")}
                    </p>
                    <p className="m-0 text-xs text-[var(--rd-muted)]">
                      {t.common.airportName}
                    </p>
                  </div>
                  <Link
                    href={`/${locale}/profile`}
                    className="rounded-lg border border-[var(--rd-border)] bg-[var(--rd-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--rd-link)] transition-colors hover:bg-[var(--rd-active)]"
                  >
                    {t.profile.title}
                  </Link>
                </div>

                <h3 className="m-0 mb-3 flex items-center gap-1.5 text-xs font-bold tracking-wide text-[var(--rd-muted)] uppercase">
                  <ShieldAlert size={14} className="text-[var(--rd-link)]" aria-hidden="true" />
                  <span>{locale === "en" ? "Reporting Guidelines" : "Panduan Pelaporan"}</span>
                </h3>
                <ul className="m-0 list-none space-y-2.5 p-0 text-xs leading-relaxed text-[var(--rd-muted)]">
                  <li className="flex items-start gap-2">
                    <CheckCircle2
                      size={14}
                      className="mt-0.5 shrink-0 text-[var(--rd-link)]"
                      aria-hidden="true"
                    />
                    <span>
                      {locale === "en"
                        ? "Attach clear photos of fence damage (up to 8 photos, max 3 MB/photo)."
                        : "Lampirkan foto bukti kerusakan pagar yang jelas (maksimal 8 foto, maks 3 MB/foto)."}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2
                      size={14}
                      className="mt-0.5 shrink-0 text-[var(--rd-link)]"
                      aria-hidden="true"
                    />
                    <span>
                      {locale === "en"
                        ? "Ensure the GPS location pin on the map matches the inspected perimeter fence segment."
                        : "Pastikan pin lokasi GPS pada peta sesuai dengan segmen pagar perimeter yang diperiksa."}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2
                      size={14}
                      className="mt-0.5 shrink-0 text-[var(--rd-link)]"
                      aria-hidden="true"
                    />
                    <span>
                      {locale === "en"
                        ? "Select specific fence parts and damage severity to expedite technician response."
                        : "Pilih bagian pagar serta tingkat kerusakan secara spesifik untuk mempercepat tindak lanjut teknisi."}
                    </span>
                  </li>
                </ul>
              </section>
            </aside>

            {/* RIGHT MAIN AREA: Unified Report History List */}
            <section
              aria-labelledby="report-history-title"
              aria-busy={loading}
              className="flex min-w-0 flex-col rounded-2xl border-2 border-[var(--rd-border)] bg-[var(--rd-surface)] p-3.5 sm:p-6"
            >
              <ReportHistoryPanel
                reports={owned}
                loading={loading}
                selectedId={selectedReportId}
                onSelect={(report) => onSelect(report.id)}
                activeFilter={filter}
                onFilterChange={onFilter}
                pageSize={5}
              />
            </section>
          </div>
        )}
        <ReportFooter />
      </main>
    </div>
  );
}
