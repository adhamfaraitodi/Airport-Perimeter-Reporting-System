"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  calculateCategoryDamageBreakdown,
  calculatePerimeterReadiness,
} from "@/lib/perimeter-readiness";
import { PerimeterMap } from "./_components/perimeter-map";
import { PerimeterReadinessCard } from "./_components/perimeter-readiness-card";
import { ReportDetailSheet } from "./_components/report-detail-sheet";
import { UpdateStatusDialog } from "./_components/update-status-dialog";
import { DashboardFooter } from "./_components/dashboard-footer";
import { ReportHistoryPanel } from "../../_components/report-history-panel";

type OperatorAction =
  | { type: "DELETE" }
  | { type: "STATUS"; targetStatus: "RESOLVED" | "OPEN" }
  | null;

const inlineAlertButton = `ml-2.5 rounded-md bg-[var(--rd-surface)] px-2.5 py-1 text-sm font-semibold text-[var(--rd-coral)] disabled:cursor-not-allowed disabled:opacity-55 ${focusRing}`;

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
  const [pendingAction, setPendingAction] = useState<OperatorAction>(null);
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
      if (session.role !== "OPERATOR" && session.role !== "CHIEF") {
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
    setPendingAction(null);
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
    setPendingAction(null);
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

  const readiness = useMemo(
    () => calculatePerimeterReadiness(reports),
    [reports]
  );

  const categoryBreakdown = useMemo(
    () => calculateCategoryDamageBreakdown(reports),
    [reports]
  );

  const selected = reports.find((report) => report.id === selectedId) || null;
  const isOperatorOrChief =
    user?.role === "OPERATOR" || user?.role === "CHIEF";

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
          className="mb-3 flex items-center gap-2 text-sm md:text-[13px]"
        >
          <span className="text-[var(--rd-muted)]">Dashboard</span>
          <span className="text-[var(--rd-muted)]/50 select-none">/</span>
          <span className="font-medium text-[var(--rd-link)]">
            Pantau Perimeter
          </span>
        </nav>

        <PerimeterReadinessCard
          summary={readiness}
          categoryBreakdown={categoryBreakdown}
          loading={loading}
          activeSearch={search}
          onSelectGrid={(code) => {
            if (!pendingAction && !locked) setSelectedId(null);
            setFilter("ALL");
            setSearch((prev) =>
              prev.trim().toUpperCase() === code ? "" : code
            );
          }}
        />

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
              disabled={locked || !!pendingAction}
              onClick={load}
            >
              Coba lagi
            </button>
          </div>
        )}
        <div className="flex h-auto min-h-0 flex-col md:grid md:h-[calc(100dvh-435px)] md:min-h-[500px] md:grid-cols-[minmax(0,1fr)_400px] md:gap-3 min-[1100px]:grid-cols-[minmax(0,1fr)_580px] min-[1100px]:gap-5">
          <PerimeterMap
            reports={visible}
            damagedGridCodes={readiness.damagedGridCodes}
            selectedId={selectedId}
            onSelect={(id) => {
              if (!pendingAction && !locked) setSelectedId(id);
            }}
          />
          <section
            className="min-h-0 flex-1 overflow-visible rounded-b-xl border border-t-0 border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] shadow-[0_-4px_15px_rgba(36,74,53,0.06)] md:overflow-y-auto md:overscroll-contain md:rounded-[14px] md:border-t md:shadow-none"
            aria-label="Panel laporan operator"
            aria-busy={loading}
          >
            {pendingAction && user ? (
              <UpdateStatusDialog
                key={`${user.id}:${pendingAction.type}:${
                  pendingAction.type === "STATUS"
                    ? pendingAction.targetStatus
                    : ""
                }:${selected?.id || "new"}`}
                user={user}
                report={selected}
                action={pendingAction.type}
                fixedStatus={
                  pendingAction.type === "STATUS"
                    ? pendingAction.targetStatus
                    : undefined
                }
                onSuccess={success}
                onCancel={cancelSubmission}
                onLock={setLocked}
              />
            ) : selected ? (
              <ReportDetailSheet
                report={selected}
                operator
                canVerifyRepair={isOperatorOrChief}
                canDelete={
                  isOperatorOrChief && selected.status !== "RESOLVED"
                }
                onVerifyAction={(targetStatus) =>
                  setPendingAction({ type: "STATUS", targetStatus })
                }
                onAction={(a) =>
                  a === "DELETE" &&
                  selected.status !== "RESOLVED" &&
                  setPendingAction({ type: "DELETE" })
                }
                onBack={() => setSelectedId(null)}
              />
            ) : (
              <ReportHistoryPanel
                reports={reports}
                loading={loading}
                selectedId={selectedId}
                onSelect={(r) => {
                  if (!pendingAction && !locked) setSelectedId(r.id);
                }}
                searchQuery={search}
                onSearchChange={setSearch}
                activeFilter={filter}
                onFilterChange={setFilter}
                isNewestFirst={newest}
                onToggleSort={() => setNewest((v) => !v)}
                pageSize={5}
                className="p-4 sm:p-5"
                showDownloadAll={true}
              />
            )}
          </section>
        </div>
        <DashboardFooter />
      </main>
    </div>
  );
}
