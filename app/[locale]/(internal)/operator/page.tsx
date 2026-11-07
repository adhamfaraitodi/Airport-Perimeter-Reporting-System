"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
import { PerimeterMap } from "./_components/perimeter-map";
import { ReportDetailSheet } from "./_components/report-detail-sheet";
import { UpdateStatusDialog } from "./_components/update-status-dialog";
import { DashboardFooter } from "./_components/dashboard-footer";
import { ReportHistoryPanel } from "../../_components/report-history-panel";

const inlineAlertButton = `ml-2.5 rounded-md bg-[var(--rd-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--rd-coral)] disabled:cursor-not-allowed disabled:opacity-55 ${focusRing}`;

export default function DashboardPage() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale || "id";
  const { theme, dark, toggleTheme } = useTheme();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [abandonedSubmissionId, setAbandonedSubmissionId] = useState<
    string | null
  >(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [action, setAction] = useState<"STATUS" | "DELETE" | null>(null);
  const [locked, setLocked] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [newest, setNewest] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
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
      setUser(session);
      const data = await api.listReports();
      setReports(data);
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
    toast.success("Perubahan berhasil disimpan", {
      description: "Status laporan dan bukti foto telah dikonfirmasi.",
    });
  }

  const visible = reports.filter((report) => {
    if (filter === "CLOSED") {
      if (!report.deletedAt) return false;
    } else {
      if (report.deletedAt) return false;
      if (filter !== "ALL" && report.status !== filter) return false;
    }
    if (!search.trim()) return true;

    const findingsText = (report.findings || [])
      .flatMap((f) => [
        f.partName,
        ...(Array.isArray(f.damages)
          ? f.damages.map((d) => (typeof d === "string" ? d : d.name))
          : []),
      ])
      .join(" ");

    return `${report.side || ""} ${report.segmentCode || ""} ${
      report.narrative || ""
    } ${report.reporterName || ""} ${report.id} ${findingsText}`
      .toLocaleLowerCase("id")
      .includes(search.toLocaleLowerCase("id"));
  });

  const selected = reports.find((report) => report.id === selectedId) || null;

  return (
    <div
      className="operator-dashboard flex min-h-dvh flex-col bg-[var(--rd-bg)] text-[var(--rd-text)]"
      data-theme={theme}
    >
      <AppHeader
        user={user}
        dark={dark}
        onToggleTheme={toggleTheme}
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
        <div className="flex h-auto min-h-0 flex-col md:grid md:h-[calc(100dvh-280px)] md:min-h-[550px] md:grid-cols-[minmax(0,1fr)_400px] md:gap-3 min-[1100px]:grid-cols-[minmax(0,1fr)_580px] min-[1100px]:gap-5">
          <PerimeterMap
            reports={visible}
            selectedId={selectedId}
            onSelect={(id) => {
              if (!action && !locked) setSelectedId(id);
            }}
          />
          <section
            className="min-h-0 flex-1 overflow-visible rounded-b-xl border border-t-0 border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] shadow-[0_-4px_15px_rgba(36,74,53,0.06)] md:overflow-y-auto md:overscroll-contain md:rounded-[14px] md:border-t md:shadow-none"
            aria-label="Panel laporan operator"
            aria-busy={loading}
          >
            {action && user ? (
              <UpdateStatusDialog
                key={`${user.id}:${action}:${selected?.id || "new"}`}
                user={user}
                report={selected}
                action={action}
                onSuccess={success}
                onCancel={cancelSubmission}
                onLock={setLocked}
              />
            ) : selected ? (
              <ReportDetailSheet
                report={selected}
                operator
                onAction={setAction}
                onBack={() => setSelectedId(null)}
              />
            ) : (
              <ReportHistoryPanel
                title="Riwayat Laporan"
                reports={reports}
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
