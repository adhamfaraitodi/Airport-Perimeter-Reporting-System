"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  setMockRole,
  type ReportRecord,
  type SessionUser,
} from "../../_lib/client-api";
import { message } from "../../_lib/draft-store";
import { toast } from "@/components/ui/sonner";
import { ReportList } from "./_components/report-list";
import { CreateReportDialog } from "./_components/create-report-dialog";
import { ReportDetail } from "./[reportId]/_components/report-detail";

export default function ReportsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [abandonedSubmissionId, setAbandonedSubmissionId] = useState<
    string | null
  >(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [action, setAction] = useState<"CREATE" | null>(null);
  const [, setLocked] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await setMockRole("REPORTER");
      const session = await api.getSession();
      setUser(session);
      const data = await api.listReports();
      setReports(data);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function cancelSubmission(options?: { abandonedSubmissionId?: string }) {
    setAction(null);
    setLocked(false);
    if (options?.abandonedSubmissionId) {
      setAbandonedSubmissionId(options.abandonedSubmissionId);
      setSelectedId(null);
      setFilter("ALL");
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
    toast.success("Laporan berhasil disimpan", {
      description: "Laporan dan bukti foto telah dikonfirmasi.",
    });
  }

  const owned = user ? reports.filter((r) => r.reporterId === user.id) : [];
  const selected = owned.find((r) => r.id === selectedId) || null;

  return (
    <ReportList
      user={user}
      reports={owned}
      loading={loading}
      error={error}
      notice={notice}
      filter={filter}
      onFilter={setFilter}
      onRefresh={load}
      onCreate={() => {
        setSelectedId(null);
        setAction("CREATE");
      }}
      onSelect={setSelectedId}
      abandonedSubmissionId={abandonedSubmissionId}
      onDismissAbandoned={() => setAbandonedSubmissionId(null)}
      formOpen={action === "CREATE"}
    >
      {action === "CREATE" && user ? (
        <CreateReportDialog
          user={user}
          onSuccess={success}
          onCancel={cancelSubmission}
          onLock={setLocked}
        />
      ) : selected ? (
        <ReportDetail
          report={selected}
          onBack={() => setSelectedId(null)}
        />
      ) : null}
    </ReportList>
  );
}
