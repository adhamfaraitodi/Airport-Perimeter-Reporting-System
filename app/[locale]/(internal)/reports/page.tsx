"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  api,
  isMock,
  setMockRole,
  type ReportRecord,
  type SessionUser,
  type UserRole,
} from "../../_lib/client-api";
import { message } from "../../_lib/draft-store";
import { ReportList } from "./_components/report-list";
import { CreateReportDialog } from "./_components/create-report-dialog";
import { ReportDetail } from "./[reportId]/_components/report-detail";

export default function ReportsPage() {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale || "id";

  const [user, setUser] = useState<SessionUser | null>(null);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [abandonedSubmissionId, setAbandonedSubmissionId] = useState<
    string | null
  >(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [action, setAction] = useState<"CREATE" | null>(null);
  const [locked, setLocked] = useState(false);
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

  async function handleSwitchRole(nextRole: UserRole) {
    if (locked) return;
    await setMockRole(nextRole);
    if (nextRole === "OPERATOR" || nextRole === "TECHNICIAN") {
      router.push(`/${locale}/dashboard`);
    } else {
      await load();
    }
  }

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
    setNotice("Berhasil disimpan. Laporan dan bukti telah dikonfirmasi.");
  }

  if (!user) {
    return (
      <main className="startup">
        <div className="brand-mark">P</div>
        <h1>
          Perimeter<span> / YIA</span>
        </h1>
        <p>Pelaporan kondisi perimeter bandara</p>
        {loading ? (
          <p role="status">Memeriksa sesi Anda…</p>
        ) : (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
      </main>
    );
  }

  const owned = reports.filter((r) => r.reporterId === user.id);
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
      isMock={isMock}
      onSwitchRole={handleSwitchRole}
      abandonedSubmissionId={abandonedSubmissionId}
      onDismissAbandoned={() => setAbandonedSubmissionId(null)}
      formOpen={action === "CREATE"}
    >
      {action === "CREATE" ? (
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
