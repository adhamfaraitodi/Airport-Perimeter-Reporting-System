"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarArrowDown,
  CalendarArrowUp,
  ClipboardCheck,
  ClipboardClock,
  ClipboardPen,
  Images,
  MapPin,
  RefreshCw,
  Search,
  Wrench,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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
  focusRing,
} from "../../_lib/ui-classes";
import { AppHeader } from "../../_components/app-header";
import { toast } from "@/components/ui/sonner";
import { PerimeterMap } from "../operator/_components/perimeter-map";
import {
  ReportDetailSheet,
  ReportStatusBadge,
} from "../operator/_components/report-detail-sheet";
import { UpdateStatusDialog } from "../operator/_components/update-status-dialog";
import { DashboardFooter } from "../operator/_components/dashboard-footer";

const filters = [
  ["ACTIVE", "Perlu Tindakan"],
  ["OPEN", "Baru"],
  ["IN_PROGRESS", "Ditangani"],
  ["RESOLVED", "Selesai"],
  ["ALL", "Semua"],
] as const;

const statusIcons = {
  OPEN: ClipboardClock,
  IN_PROGRESS: ClipboardPen,
  RESOLVED: ClipboardCheck,
} as const;

const inlineAlertButton = `ml-2.5 rounded-md bg-[var(--rd-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--rd-coral)] disabled:cursor-not-allowed disabled:opacity-55 ${focusRing}`;

const button = `transition-colors ${focusRing}`;

export default function TechnicianDashboardPage() {
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
  const [filter, setFilter] = useState("ACTIVE");
  const [search, setSearch] = useState("");
  const [newest, setNewest] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await setMockRole("TECHNICIAN");
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
      setFilter("ACTIVE");
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
  }

  const activeReports = reports.filter((report) => !report.deletedAt);

  const countOpen = activeReports.filter((r) => r.status === "OPEN").length;
  const countInProgress = activeReports.filter(
    (r) => r.status === "IN_PROGRESS"
  ).length;
  const countResolved = activeReports.filter(
    (r) => r.status === "RESOLVED"
  ).length;

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

  const SortIcon = newest ? CalendarArrowDown : CalendarArrowUp;

  return (
    <div
      className="operator-dashboard min-h-dvh bg-[var(--rd-bg)] text-[var(--rd-text)]"
      data-theme={theme}
    >
      <AppHeader
        user={user}
        dark={dark}
        onToggleTheme={toggleTheme}
        roleLabel="Teknisi perimeter"
        containerClassName="max-w-[1700px] min-[1100px]:px-[5%]"
      />
      <main className="mx-auto max-w-[1700px] px-3 pt-4 md:px-[3%] md:pt-6 min-[1100px]:px-[5%]">
        <nav
          aria-label="Breadcrumb"
          className="mb-3 flex items-center gap-2 text-xs md:text-[13px]"
        >
          <span className="text-[var(--rd-muted)]">Teknisi</span>
          <span className="text-[var(--rd-muted)]/50 select-none">/</span>
          <span className="font-medium text-[var(--rd-link)]">
            Tugas Perbaikan Perimeter
          </span>
        </nav>

        <div className="mb-4 flex items-center justify-between gap-2 px-1.5 md:mb-6 md:gap-5 md:px-0">
          <div>
            <h1 className="m-0 mb-1.5 text-xl leading-tight font-normal sm:text-3xl">
              Tugas Perbaikan Perimeter,
            </h1>
            <p className="m-0 hidden text-sm text-[var(--rd-muted)] md:block">
              Pantau lokasi temuan kerusakan pagar perimeter, perbarui progres
              perbaikan, dan unggah foto bukti penyelesaian di lapangan.
            </p>
          </div>
          <button
            type="button"
            disabled={locked || !!action || loading}
            onClick={load}
            aria-label="Segarkan daftar tugas"
            title="Segarkan daftar tugas"
            className="grid min-h-10 w-12 place-items-center rounded-[10px] border-2 border-solid border-[var(--rd-primary)] bg-[var(--rd-active)] p-0 text-[var(--rd-link)] transition-colors disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)]"
          >
            <RefreshCw
              size={21}
              aria-hidden="true"
              className={
                loading ? "animate-spin motion-reduce:animate-none" : ""
              }
            />
          </button>
        </div>

        {/* Summary Cards for Technician */}
        <section
          aria-label="Ringkasan tugas perbaikan"
          className="mb-4 grid grid-cols-3 gap-2.5 sm:gap-4 md:mb-6"
        >
          <div className="flex items-center gap-3 rounded-[14px] border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-3 sm:p-4">
            <span
              data-status="OPEN"
              className="rd-status grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--rd-tint)] text-[var(--rd-status)] sm:size-11"
            >
              <ClipboardClock size={21} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              {loading ? (
                <Skeleton className="mb-1 h-6 w-10 rounded-md sm:h-7 sm:w-12" />
              ) : (
                <strong className="block text-lg leading-tight font-semibold text-[var(--rd-text)] sm:text-2xl">
                  {countOpen}
                </strong>
              )}
              <span className="block truncate text-[10px] text-[var(--rd-muted)] sm:text-xs">
                Menunggu Tindakan (Baru)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-[14px] border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-3 sm:p-4">
            <span
              data-status="IN_PROGRESS"
              className="rd-status grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--rd-tint)] text-[var(--rd-status)] sm:size-11"
            >
              <Wrench size={20} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              {loading ? (
                <Skeleton className="mb-1 h-6 w-10 rounded-md sm:h-7 sm:w-12" />
              ) : (
                <strong className="block text-lg leading-tight font-semibold text-[var(--rd-text)] sm:text-2xl">
                  {countInProgress}
                </strong>
              )}
              <span className="block truncate text-[10px] text-[var(--rd-muted)] sm:text-xs">
                Sedang Dikerjakan
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-[14px] border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-3 sm:p-4">
            <span
              data-status="RESOLVED"
              className="rd-status grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--rd-tint)] text-[var(--rd-status)] sm:size-11"
            >
              <ClipboardCheck size={21} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              {loading ? (
                <Skeleton className="mb-1 h-6 w-10 rounded-md sm:h-7 sm:w-12" />
              ) : (
                <strong className="block text-lg leading-tight font-semibold text-[var(--rd-text)] sm:text-2xl">
                  {countResolved}
                </strong>
              )}
              <span className="block truncate text-[10px] text-[var(--rd-muted)] sm:text-xs">
                Selesai Diperbaiki
              </span>
            </div>
          </div>
        </section>

        {abandonedSubmissionId && (
          <div className={alertBox} role="status">
            <strong>
              Percobaan lokal ditinggalkan, bukan dibatalkan di server.
            </strong>
            <p className="mt-2 mb-3">
              Transaksi: {abandonedSubmissionId}. Draft teks tetap tersimpan.
              Periksa daftar dan riwayat laporan sebelum mengirim kembali;
              transaksi sebelumnya mungkin sudah tersimpan.
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
                statusActionLabel={
                  selected.status === "OPEN"
                    ? "Mulai / Perbarui Status Perbaikan"
                    : selected.status === "IN_PROGRESS"
                      ? "Selesaikan Perbaikan & Unggah Bukti"
                      : "Perbarui Status Penanganan"
                }
                onAction={() => setAction("STATUS")}
                onBack={() => setSelectedId(null)}
              />
            ) : (
              <>
                <div className="flex items-center justify-between px-[28px] pt-[17px] md:pt-[23px]">
                  <h2 className="m-0 text-base leading-normal font-normal sm:text-lg">
                    Daftar Tugas Lapangan
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
                      aria-label="Cari tugas perbaikan"
                      placeholder="Cari segmen grid, sisi, atau jenis kerusakan…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm text-[var(--rd-text)] outline-none placeholder:text-[var(--rd-muted)]"
                    />
                  </label>
                  <div className="flex items-center justify-between gap-2 border-[var(--rd-border)] pt-2 pb-3">
                    <div
                      role="group"
                      aria-label="Filter status tugas perbaikan"
                      className="flex gap-1 overflow-x-auto sm:gap-2"
                    >
                      {filters.map(([value, label]) => (
                        <button
                          type="button"
                          key={value}
                          aria-pressed={filter === value}
                          onClick={() => setFilter(value)}
                          className={`${button} min-h-9 shrink-0 rounded-xl px-2 py-1 text-[11px] sm:px-3 sm:text-sm ${
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
                </div>
                <div className="flex items-center justify-between border-b border-solid border-[var(--rd-border)] px-[15px] py-1.5 text-[9px] text-[var(--rd-muted)] md:px-6 md:text-[10px]">
                  {loading ? (
                    <Skeleton className="h-3.5 w-32 rounded" />
                  ) : (
                    <span>{visible.length} tugas perbaikan ditemukan</span>
                  )}
                </div>
                {loading ? (
                  <div>
                    {[0, 1, 2].map((index) => (
                      <div
                        key={index}
                        className="flex w-full gap-3 border-b border-solid border-[var(--rd-border)] px-[15px] py-[19px] last:border-b-0 md:py-[18px] min-[1100px]:p-5"
                      >
                        <Skeleton className="mt-[5px] h-9 w-[30px] shrink-0 rounded-[10px] md:hidden min-[1100px]:block" />
                        <div className="min-w-0 flex-1 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <Skeleton className="h-3.5 w-24 rounded" />
                            <Skeleton className="h-5 w-20 rounded-full" />
                          </div>
                          <Skeleton className="h-4 w-3/5 rounded" />
                          <Skeleton className="h-3.5 w-full rounded" />
                          <div className="flex justify-between gap-2 pt-1">
                            <Skeleton className="h-3 w-28 rounded" />
                            <Skeleton className="h-3 w-20 rounded" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div>
                      {[...visible]
                        .sort(
                          (a, b) =>
                            (new Date(b.createdAt).getTime() -
                              new Date(a.createdAt).getTime()) *
                            (newest ? 1 : -1)
                        )
                        .map((report) => (
                          <TechnicianTaskCard
                            key={report.id}
                            report={report}
                            onSelect={setSelectedId}
                          />
                        ))}
                    </div>
                    {!visible.length && (
                      <div className="px-6 py-[50px] text-center text-[var(--rd-muted)]">
                        <span className="text-4xl">⌖</span>
                        <h3 className="mb-3 text-[15px] font-medium text-[var(--rd-text)]">
                          {search || filter !== "ACTIVE"
                            ? "Tidak ada tugas yang cocok"
                            : "Semua tugas perbaikan telah tertangani"}
                        </h3>
                        <p className="mx-auto mb-5 max-w-[290px] text-xs leading-relaxed">
                          Pilih filter &ldquo;Semua&rdquo; atau &ldquo;Selesai&rdquo; untuk
                          melihat riwayat perbaikan perimeter.
                        </p>
                        {(search || filter !== "ACTIVE") && (
                          <button
                            type="button"
                            className={btnSecondary}
                            onClick={() => {
                              setSearch("");
                              setFilter("ACTIVE");
                            }}
                          >
                            Tampilkan tugas aktif
                          </button>
                        )}
                      </div>
                    )}
                  </>
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

function TechnicianTaskCard({
  report,
  onSelect,
}: {
  report: ReportRecord;
  onSelect: (id: string) => void;
}) {
  const status = report.status;
  const Icon =
    statusIcons[status as keyof typeof statusIcons] || ClipboardClock;
  const titleLabel = report.findings?.length
    ? report.findings.map((f) => f.partName).join(", ")
    : `Perimeter sisi ${report.side || "belum ditentukan"}`;
  const damageChips = (report.findings || []).flatMap((f) =>
    (f.damages || []).map((d) => (typeof d === "string" ? d : d.name))
  );

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
        <span className="mb-[9px] flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-[9px] tracking-[0.9px] text-[var(--rd-muted)] md:text-[10px]">
            <span>#{String(report.id).slice(-6).toUpperCase()}</span>
            {report.segmentCode && (
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--rd-active)] px-1.5 py-0.5 font-semibold tracking-normal text-[var(--rd-link)]">
                <MapPin size={10} aria-hidden="true" />
                Grid {report.segmentCode}
              </span>
            )}
          </span>
          <ReportStatusBadge report={report} />
        </span>
        <span className="mb-1.5 block text-[13px] font-semibold md:text-[15px]">
          {titleLabel}
        </span>
        {damageChips.length > 0 && (
          <span className="mb-2 flex flex-wrap gap-1">
            {damageChips.map((chip, idx) => (
              <span
                key={`${chip}-${idx}`}
                className="rounded border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] px-1.5 py-0.5 text-[10px] text-[var(--rd-muted)]"
              >
                {chip}
              </span>
            ))}
          </span>
        )}
        <span className="mb-[13px] block truncate text-[11px] text-[var(--rd-muted)] md:text-xs">
          {report.narrative}
        </span>
        <span className="flex justify-between gap-2 text-[9px] text-[var(--rd-muted)]">
          <span>
            {report.side ? `Sisi ${report.side} · ` : ""}
            {dateText(report.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Images size={12} className="text-[var(--rd-link)]" aria-hidden="true" />
            {report.images?.length || 0} foto{" "}
            <b className="pl-2 text-xs font-semibold text-[var(--rd-link)]">
              Tindak lanjuti →
            </b>
          </span>
        </span>
      </span>
    </button>
  );
}
