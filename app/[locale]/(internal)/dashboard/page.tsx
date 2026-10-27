"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ClipboardCheck,
  ClipboardClock,
  ClipboardPen,
  ClipboardX,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  api,
  setMockRole,
  type ReportRecord,
  type SessionUser,
} from "../../_lib/client-api";
import { dateText, message } from "../../_lib/draft-store";
import { useTheme } from "../../_lib/use-theme";
import {
  alertBox,
  btnSecondary,
  eyebrow,
  focusRing,
} from "../../_lib/ui-classes";
import { AppHeader } from "../../_components/app-header";
import { StartupScreen } from "../../_components/startup-screen";
import { toast } from "@/components/ui/sonner";
import { PerimeterMap } from "./_components/perimeter-map";
import {
  ReportDetailSheet,
  ReportStatusBadge,
} from "./_components/report-detail-sheet";
import { UpdateStatusDialog } from "./_components/update-status-dialog";
import { DashboardFooter } from "./_components/dashboard-footer";

const filters = [
  ["ALL", "Semua"],
  ["OPEN", "Baru"],
  ["IN_PROGRESS", "Ditangani"],
  ["RESOLVED", "Selesai"],
  ["CLOSED", "Ditutup"],
] as const;

const statusIcons = {
  OPEN: ClipboardClock,
  IN_PROGRESS: ClipboardPen,
  RESOLVED: ClipboardCheck,
  CLOSED: ClipboardX,
} as const;

const inlineAlertButton = `ml-2.5 rounded-md bg-[var(--rd-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--rd-coral)] disabled:cursor-not-allowed disabled:opacity-55 ${focusRing}`;

export default function DashboardPage() {
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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await setMockRole("OPERATOR");
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

  if (!user) {
    return <StartupScreen loading={loading} error={error} />;
  }

  const visible = reports.filter(
    (report) =>
      !report.deletedAt &&
      (filter === "ALL" || report.status === filter) &&
      `${report.side} ${report.narrative} ${report.reporterName} ${report.id} ${(
        report.findings || []
      )
        .map((f) => f.partName)
        .join(" ")}`
        .toLocaleLowerCase("id")
        .includes(search.toLocaleLowerCase("id"))
  );

  const selected = reports.find((report) => report.id === selectedId) || null;
  const active = reports.filter(
    (report) => !report.deletedAt && report.status !== "RESOLVED"
  ).length;

  return (
    <div
      className="operator-dashboard min-h-dvh bg-[var(--rd-bg)] text-[var(--rd-text)]"
      data-theme={theme}
    >
      <AppHeader
        user={user}
        dark={dark}
        onToggleTheme={toggleTheme}
        roleLabel="Operator perimeter"
        containerClassName="max-w-[1700px] min-[1100px]:px-[5%]"
      />
      <main className="mx-auto max-w-[1700px] px-3 pt-[18px] md:px-[3%] md:pt-9 min-[1100px]:px-[5%]">
        <div className="mb-[18px] flex items-center justify-between gap-2 px-1.5 md:mb-[30px] md:gap-5 md:px-0">
          <div>
            <span className={eyebrow}>YOGYAKARTA INTERNATIONAL AIRPORT</span>
            <h1 className="m-0 mb-2 text-xl leading-tight font-normal sm:text-3xl">
              Pantau perimeter.
            </h1>
            <p className="m-0 hidden text-sm text-[var(--rd-muted)] md:block">
              Satu peta untuk kondisi dan tindak lanjut di lapangan.
            </p>
          </div>
          <button
            type="button"
            className={`${btnSecondary} shrink-0 max-md:min-h-9 max-md:px-2.5 max-md:text-xs`}
            disabled={locked || !!action || loading}
            onClick={load}
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
              className={loading ? "animate-spin motion-reduce:animate-none" : ""}
            />
            {loading ? "Memuat…" : "Segarkan"}
          </button>
        </div>
        {abandonedSubmissionId && (
          <div className={alertBox} role="status">
            <strong>
              Percobaan lokal ditinggalkan, bukan dibatalkan di server.
            </strong>
            <p className="mt-2 mb-3">
              Transaksi: {abandonedSubmissionId}. Draft teks tetap tersimpan.
              Periksa daftar dan riwayat laporan sebelum mengirim kembali;
              transaksi sebelumnya mungkin sudah tersimpan. Tidak ada pengiriman
              baru otomatis.
            </p>
            <button
              type="button"
              className={`${inlineAlertButton} ml-0`}
              onClick={() => setAbandonedSubmissionId(null)}
            >
              Saya sudah memeriksa
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
        <div className="flex h-[calc(100dvh-184px)] min-h-[550px] flex-col md:grid md:h-[calc(100dvh-280px)] md:grid-cols-[minmax(0,1fr)_360px] md:gap-3 min-[1100px]:grid-cols-[minmax(0,1fr)_410px] min-[1100px]:gap-5">
          <PerimeterMap
            reports={visible}
            selectedId={selectedId}
            onSelect={(id) => {
              if (!action && !locked) setSelectedId(id);
            }}
          />
          <section
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-b-xl border border-t-0 border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] shadow-[0_-4px_15px_rgba(36,74,53,0.06)] md:rounded-[14px] md:border-t md:shadow-none"
            aria-label="Panel laporan operator"
          >
            {action ? (
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
              <>
                <div className="flex items-center justify-between px-[22px] pt-[17px] md:pt-[23px]">
                  <h2 className="m-0 text-[17px] font-semibold">
                    Laporan lapangan
                  </h2>
                </div>
                <div className="px-[15px] pt-3 pb-1.5 md:px-5 md:pt-[18px]">
                  <label className="flex items-center gap-2 rounded-lg border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--rd-link)]">
                    <Search
                      size={18}
                      className="shrink-0 text-[var(--rd-muted)]"
                      aria-hidden="true"
                    />
                    <input
                      aria-label="Cari laporan"
                      placeholder="Cari lokasi atau isi laporan…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm text-[var(--rd-text)] outline-none placeholder:text-[var(--rd-muted)]"
                    />
                  </label>
                  <div
                    role="group"
                    aria-label="Filter status"
                    className="mt-3 flex gap-px overflow-x-auto pb-[3px] md:mt-[18px] md:gap-[5px]"
                  >
                    {filters.map(([value, label]) => (
                      <button
                        type="button"
                        key={value}
                        aria-pressed={filter === value}
                        onClick={() => setFilter(value)}
                        className={`min-h-9 shrink-0 rounded-xl px-2.5 py-2 text-[10px] whitespace-nowrap transition-colors md:px-[13px] md:text-[11px] ${focusRing} ${
                          filter === value
                            ? "bg-[var(--rd-active)] font-bold text-[var(--rd-link)]"
                            : "bg-transparent text-[var(--rd-muted)] hover:bg-[var(--rd-hover)]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between border-b border-solid border-[var(--rd-border)] px-[15px] py-3 text-[9px] text-[var(--rd-muted)] md:px-6 md:text-[10px]">
                  <span>{visible.length} laporan ditemukan</span>
                  <span>Terbaru lebih dahulu</span>
                </div>
                <div>
                  {[...visible]
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime()
                    )
                    .map((report) => (
                      <OperatorReportCard
                        key={report.id}
                        report={report}
                        onSelect={setSelectedId}
                      />
                    ))}
                </div>
                {!visible.length && (
                  <div className="px-6 py-[50px] text-center text-[var(--rd-muted)]">
                    <span>⌖</span>
                    <h3 className="mb-3 text-[15px] font-semibold text-[var(--rd-text)]">
                      {search || filter !== "ALL"
                        ? "Tidak ada laporan yang cocok"
                        : "Belum ada laporan"}
                    </h3>
                    <p className="mx-auto mb-5 max-w-[290px] text-xs leading-relaxed">
                      Titik laporan akan muncul di sini saat laporan diterima.
                    </p>
                    {(search || filter !== "ALL") && (
                      <button
                        type="button"
                        className={btnSecondary}
                        onClick={() => {
                          setSearch("");
                          setFilter("ALL");
                        }}
                      >
                        Reset pencarian
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
        <DashboardFooter />
      </main>
    </div>
  );
}

function OperatorReportCard({
  report,
  onSelect,
}: {
  report: ReportRecord;
  onSelect: (id: string) => void;
}) {
  const status = report.deletedAt ? "CLOSED" : report.status;
  const Icon =
    statusIcons[status as keyof typeof statusIcons] || ClipboardClock;
  const titleLabel = report.findings?.length
    ? report.findings.map((f) => f.partName).join(", ")
    : `Perimeter sisi ${report.side || "belum ditentukan"}`;

  return (
    <button
      type="button"
      onClick={() => onSelect(report.id)}
      className={`flex w-full gap-3 border-b border-solid border-[var(--rd-border)] bg-transparent px-[15px] py-[19px] text-left text-[var(--rd-text)] transition-colors last:border-b-0 hover:bg-[var(--rd-hover)] md:py-[18px] min-[1100px]:p-5 ${focusRing}`}
    >
      <span
        data-status={status}
        className="rd-status mt-[5px] grid h-9 w-[30px] shrink-0 place-items-center rounded-[10px] bg-[var(--rd-tint)] text-[var(--rd-status)] md:hidden min-[1100px]:grid"
      >
        <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
      </span>
      <span className="block min-w-0 flex-1">
        <span className="mb-[9px] flex items-center justify-between gap-2">
          <span className="text-[9px] tracking-[0.9px] text-[var(--rd-muted)] md:text-[10px]">
            #{String(report.id).slice(-6).toUpperCase()}
          </span>
          <ReportStatusBadge report={report} />
        </span>
        <span className="mb-1.5 block text-[13px] font-semibold md:text-[15px]">
          {titleLabel}
        </span>
        <span className="mb-[13px] block truncate text-[11px] text-[var(--rd-muted)] md:text-xs">
          {report.narrative}
        </span>
        <span className="flex justify-between gap-2 text-[9px] text-[var(--rd-muted)]">
          <span>{dateText(report.createdAt)}</span>
          <span>
            {report.images?.length || 0} foto{" "}
            <b className="pl-2.5 text-sm text-[var(--rd-link)]">→</b>
          </span>
        </span>
      </span>
    </button>
  );
}
