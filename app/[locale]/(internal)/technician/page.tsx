"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Clock, ClipboardList, Wrench } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  api,
  type ReportRecord,
  type SessionUser,
} from "../../_lib/client-api";
import { message } from "../../_lib/draft-store";
import { useTheme } from "../../_lib/use-theme";
import { alertBox, focusRing } from "../../_lib/ui-classes";
import { AppHeader } from "../../_components/app-header";
import { toast } from "@/components/ui/sonner";
import { PerimeterMap } from "../operator/_components/perimeter-map";
import { ReportDetailSheet } from "../operator/_components/report-detail-sheet";
import { UpdateStatusDialog } from "../operator/_components/update-status-dialog";
import { DashboardFooter } from "../operator/_components/dashboard-footer";
import { ReportHistoryPanel } from "../../_components/report-history-panel";
import { getTechnicianDashboardDataAction } from "./_lib/technician.actions";
import type { TechnicianTaskSummary } from "./_lib/technician.schema";

const inlineAlertButton = `ml-2.5 rounded-md bg-[var(--rd-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--rd-coral)] disabled:cursor-not-allowed disabled:opacity-55 ${focusRing}`;

export default function TechnicianDashboardPage() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale || "id";
  const { theme, dark, toggleTheme } = useTheme();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [summary, setSummary] = useState<TechnicianTaskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [abandonedSubmissionId, setAbandonedSubmissionId] = useState<
    string | null
  >(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [action, setAction] = useState<"STATUS" | null>(null);
  const [locked, setLocked] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [newest, setNewest] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getTechnicianDashboardDataAction();
      if (!res.success) {
        // Fallback for edge-case session lookup or client redirects
        const session = await api.getSession();
        if (!session) {
          window.location.href = `/${locale}/login`;
          return;
        }
        if (session.role !== "TECHNICIAN") {
          window.location.href = `/${locale}/${
            session.role === "OPERATOR" ? "operator" : "reports"
          }`;
          return;
        }
        setUser(session);
        const data = await api.listReports();
        setReports(data);
        return;
      }

      if (res.user) {
        if (res.user.role !== "TECHNICIAN" && res.user.role !== "OPERATOR") {
          window.location.href = `/${locale}/reports`;
          return;
        }
        setUser(res.user);
      }
      if (res.reports) {
        setReports(res.reports);
      }
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    load();
  }, [load]);

  async function cancelSubmission(options?: { abandonedSubmissionId?: string }) {
    setAction(null);
    setLocked(false);
    if (options?.abandonedSubmissionId) {
      setAbandonedSubmissionId(options.abandonedSubmissionId);
      setSelectedId(null);
      setFilter("ALL");
      setSearch("");
      await load();
    }
  }

  function success(report: ReportRecord) {
    setReports((old) => [
      report,
      ...old.filter((item) => item.id !== report.id),
    ]);
    setAction(null);
    setLocked(false);
    setSelectedId(report.id);
    toast.success("Progres perbaikan berhasil disimpan", {
      description: "Status perbaikan dan foto bukti lapangan telah diperbarui.",
    });
    // Refresh aggregation counters directly from PostgreSQL
    load();
  }

  const activeReports = reports.filter((report) => !report.deletedAt);

  const countOpen = summary
    ? summary.open
    : activeReports.filter((r) => r.status === "OPEN").length;
  const countInProgress = summary
    ? summary.inProgress
    : activeReports.filter((r) => r.status === "IN_PROGRESS").length;
  const countResolved = summary
    ? summary.resolved
    : activeReports.filter((r) => r.status === "RESOLVED").length;
  const countTotal = summary ? summary.totalActive : activeReports.length;

  const visible = activeReports.filter((report) => {
    const matchesStatus =
      filter === "ALL"
        ? true
        : filter === "ACTIVE"
          ? report.status === "OPEN" || report.status === "IN_PROGRESS"
          : report.status === filter;

    if (!matchesStatus) return false;

    const searchableText = `${report.segmentCode || ""} ${report.side} ${
      report.narrative
    } ${report.reporterName} ${report.id} ${(report.findings || [])
      .flatMap((f) => [
        f.partName,
        ...(f.damages || []).map((d) => (typeof d === "string" ? d : d.name)),
      ])
      .join(" ")}`.toLocaleLowerCase("id");

    return searchableText.includes(search.toLocaleLowerCase("id"));
  });

  const selected =
    activeReports.find((report) => report.id === selectedId) || null;

  return (
    <div
      className="operator-dashboard flex min-h-dvh flex-col bg-[var(--rd-bg)] text-[var(--rd-text)]"
      data-theme={theme}
    >
      <AppHeader
        user={user}
        dark={dark}
        onToggleTheme={toggleTheme}
        roleLabel="Teknisi pemeliharaan"
        containerClassName="max-w-[1700px] min-[1100px]:px-[5%]"
      />
      <main className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col px-3 pt-4 md:px-[3%] md:pt-6 min-[1100px]:px-[5%]">
        <nav
          aria-label="Breadcrumb"
          className="mb-3 flex items-center gap-2 text-xs md:text-[13px]"
        >
          <span className="text-[var(--rd-muted)]">Dashboard</span>
          <span className="text-[var(--rd-muted)]/50 select-none">/</span>
          <span className="font-medium text-[var(--rd-link)]">
            Pantau Perimeter
          </span>
        </nav>

        {/* Task Summary Badges for Technician */}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-3 shadow-xs">
            <span
              data-status="OPEN"
              className="rd-status flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--rd-tint)] text-[var(--rd-status)]"
            >
              <Wrench className="size-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] text-[var(--rd-muted)] sm:text-xs">
                Perlu Ditangani
              </span>
              {loading ? (
                <Skeleton className="mt-1 h-5 w-10 rounded" />
              ) : (
                <span className="text-base font-bold sm:text-lg">
                  {countOpen}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-3 shadow-xs">
            <span
              data-status="IN_PROGRESS"
              className="rd-status flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--rd-tint)] text-[var(--rd-status)]"
            >
              <Clock className="size-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] text-[var(--rd-muted)] sm:text-xs">
                Sedang Dikerjakan
              </span>
              {loading ? (
                <Skeleton className="mt-1 h-5 w-10 rounded" />
              ) : (
                <span className="text-base font-bold sm:text-lg">
                  {countInProgress}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-3 shadow-xs">
            <span
              data-status="RESOLVED"
              className="rd-status flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--rd-tint)] text-[var(--rd-status)]"
            >
              <CheckCircle2 className="size-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] text-[var(--rd-muted)] sm:text-xs">
                Selesai Diperbaiki
              </span>
              {loading ? (
                <Skeleton className="mt-1 h-5 w-10 rounded" />
              ) : (
                <span className="text-base font-bold sm:text-lg">
                  {countResolved}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-3 shadow-xs">
            <span className="rd-status flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--rd-tint)] text-[var(--rd-status)]">
              <ClipboardList className="size-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] text-[var(--rd-muted)] sm:text-xs">
                Total Seluruh Laporan
              </span>
              {loading ? (
                <Skeleton className="mt-1 h-5 w-10 rounded" />
              ) : (
                <span className="text-base font-bold sm:text-lg">
                  {countTotal}
                </span>
              )}
            </div>
          </div>
        </div>

        {abandonedSubmissionId && (
          <div className={alertBox} role="status">
            <span>
              Pembaruan status #{abandonedSubmissionId} sedang diproses. Mohon
              tunggu sejenak.
            </span>
            <button
              type="button"
              className={inlineAlertButton}
              onClick={() => setAbandonedSubmissionId(null)}
            >
              Tutup
            </button>
          </div>
        )}
        {error && (
          <div className={alertBox} role="alert">
            {error}
            <button
              type="button"
              className={inlineAlertButton}
              disabled={locked || !!action}
              onClick={load}
            >
              Coba lagi
            </button>
          </div>
        )}

        <div className="flex h-[calc(100dvh-240px)] min-h-[550px] flex-col md:grid md:h-[calc(100dvh-330px)] md:grid-cols-[minmax(0,1fr)_420px] md:gap-3 min-[1100px]:grid-cols-[minmax(0,1fr)_580px] min-[1100px]:gap-5">
          <PerimeterMap
            reports={visible}
            selectedId={selectedId}
            onSelect={(id) => {
              if (!action && !locked) setSelectedId(id);
            }}
          />
          <section
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-b-xl border border-t-0 border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] shadow-[0_-4px_15px_rgba(36,74,53,0.06)] md:rounded-[14px] md:border-t md:shadow-none"
            aria-label="Panel tugas perbaikan teknisi"
            aria-busy={loading}
          >
            {action && user ? (
              <UpdateStatusDialog
                key={`${user.id}:${action}:${selected?.id || "new"}`}
                user={user}
                report={selected}
                action="STATUS"
                onSuccess={success}
                onCancel={cancelSubmission}
                onLock={setLocked}
              />
            ) : selected ? (
              <ReportDetailSheet
                report={selected}
                operator
                canDelete={false}
                canUpdateStatus
                statusActionDisabled={
                  selected.status === "RESOLVED" || !!selected.deletedAt
                }
                statusActionLabel={
                  selected.status === "OPEN"
                    ? "Mulai Kerjakan"
                    : "Selesai Diperbaiki"
                }
                onAction={() => setAction("STATUS")}
                onBack={() => setSelectedId(null)}
              />
            ) : (
              <ReportHistoryPanel
                title="Riwayat Laporan"
                reports={activeReports}
                loading={loading}
                selectedId={selectedId}
                onSelect={(r) => {
                  if (!action && !locked) setSelectedId(r.id);
                }}
                searchQuery={search}
                onSearchChange={setSearch}
                activeFilter={filter}
                onFilterChange={setFilter}
                isNewestFirst={newest}
                onToggleSort={() => setNewest((v) => !v)}
                pageSize={5}
                className="p-4 sm:p-5"
              />
            )}
          </section>
        </div>
        <DashboardFooter />
      </main>
    </div>
  );
}
