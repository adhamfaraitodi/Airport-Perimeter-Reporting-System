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
import { dateText, message } from "../../_lib/draft-store";
import { PerimeterMap } from "./_components/perimeter-map";
import {
  ReportDetailSheet,
  ReportStatusBadge,
} from "./_components/report-detail-sheet";
import { UpdateStatusDialog } from "./_components/update-status-dialog";

export default function DashboardPage() {
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
  const [action, setAction] = useState<"STATUS" | "DELETE" | null>(null);
  const [locked, setLocked] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

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

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function switchRole(nextRole: UserRole) {
    if (locked) return;
    await setMockRole(nextRole);
    if (nextRole === "REPORTER") {
      router.push(`/${locale}/reports`);
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
    <div className="app operator">
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            if (!locked) {
              setSelectedId(null);
              setAction(null);
            }
          }}
        >
          <span className="brand-mark">P</span>
          <span>
            perimeter
            <span className="brand-airport">YIA · AIRPORT OPERATIONS</span>
          </span>
        </a>
        <div className="account">
          {isMock && (
            <label className="mock-control">
              MODE DEMO
              <select
                aria-label="Peran demo"
                disabled={locked || loading}
                value={user.role}
                onChange={(e) => switchRole(e.target.value as UserRole)}
              >
                <option value="REPORTER">Pelapor</option>
                <option value="OPERATOR">Operator</option>
              </select>
            </label>
          )}
          <span className="avatar">
            {(user.name || user.email || "?").slice(0, 1).toUpperCase()}
          </span>
          <div className="account-name">
            <strong>{user.name || user.email || "Pengguna"}</strong>
            <span>Operator perimeter</span>
          </div>
        </div>
      </header>
      {notice && (
        <div className="toast" role="status">
          ✓ {notice}
        </div>
      )}
      <main>
        <div className="page-heading">
          <div>
            <span className="eyebrow">YOGYAKARTA INTERNATIONAL AIRPORT</span>
            <h1>Pantau perimeter.</h1>
            <p className="muted">
              Satu peta untuk kondisi dan tindak lanjut di lapangan.
            </p>
          </div>
          <div className="heading-actions">
            <button
              type="button"
              className="secondary"
              disabled={locked || !!action || loading}
              onClick={load}
            >
              {loading ? "Memuat…" : "↻ Segarkan"}
            </button>
          </div>
        </div>
        {abandonedSubmissionId && (
          <div className="alert global-error" role="status">
            <strong>
              Percobaan lokal ditinggalkan, bukan dibatalkan di server.
            </strong>
            <p>
              Transaksi: {abandonedSubmissionId}. Draft teks tetap tersimpan.
              Periksa daftar dan riwayat laporan sebelum mengirim kembali;
              transaksi sebelumnya mungkin sudah tersimpan. Tidak ada pengiriman
              baru otomatis.
            </p>
            <button
              type="button"
              onClick={() => setAbandonedSubmissionId(null)}
            >
              Saya sudah memeriksa
            </button>
          </div>
        )}
        {error && (
          <div className="alert global-error" role="alert">
            {error}{" "}
            <button
              type="button"
              disabled={locked || !!action}
              onClick={load}
            >
              Coba lagi
            </button>
          </div>
        )}
        <div className="operator-workspace">
          <PerimeterMap
            reports={visible}
            selectedId={selectedId}
            onSelect={(id) => {
              if (!action && !locked) setSelectedId(id);
            }}
          />
          <section
            className="content-panel"
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
                <div className="panel-title">
                  <h2>Laporan lapangan</h2>
                  <span className="count-pill">{active} aktif</span>
                </div>
                <div className="list-tools">
                  <label className="search">
                    <span>⌕</span>
                    <input
                      aria-label="Cari laporan"
                      placeholder="Cari lokasi atau isi laporan…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <div className="filters" aria-label="Filter status">
                    {[
                      ["ALL", "Semua"],
                      ["OPEN", "Baru"],
                      ["IN_PROGRESS", "Ditangani"],
                      ["RESOLVED", "Selesai"],
                    ].map(([value, label]) => (
                      <button
                        type="button"
                        key={value}
                        className={filter === value ? "active" : ""}
                        aria-pressed={filter === value}
                        onClick={() => setFilter(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="list-caption">
                  <span>{visible.length} laporan pada peta</span>
                  <span>Terbaru lebih dahulu</span>
                </div>
                <div className="report-list">
                  {[...visible]
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime()
                    )
                    .map((report) => {
                      const titleLabel = report.findings?.length
                        ? report.findings.map((f) => f.partName).join(", ")
                        : `Perimeter sisi ${report.side || "belum ditentukan"}`;
                      return (
                        <button
                          type="button"
                          className="report-card"
                          key={report.id}
                          onClick={() => setSelectedId(report.id)}
                        >
                          <div
                            className={`report-symbol ${
                              report.deletedAt ? "CLOSED" : report.status
                            }`}
                          >
                            {report.deletedAt
                              ? "–"
                              : report.status === "RESOLVED"
                                ? "✓"
                                : "!"}
                          </div>
                          <div className="report-card-body">
                            <div className="card-top">
                              <span className="reference">
                                #{String(report.id).slice(-6).toUpperCase()}
                              </span>
                              <ReportStatusBadge report={report} />
                            </div>
                            <h3>{titleLabel}</h3>
                            <p>{report.narrative}</p>
                            <div className="card-meta">
                              <span>{dateText(report.createdAt)}</span>
                              <span>
                                {report.images?.length || 0} foto <b>→</b>
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
                {!visible.length && (
                  <div className="empty">
                    <span>⌖</span>
                    <h3>
                      {search || filter !== "ALL"
                        ? "Tidak ada laporan yang cocok"
                        : "Belum ada laporan"}
                    </h3>
                    <p>
                      Titik laporan akan muncul di sini saat laporan diterima.
                    </p>
                    {(search || filter !== "ALL") && (
                      <button
                        type="button"
                        className="secondary"
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
        <footer>
          PERIMETER / YIA{" "}
          <span>Waktu Indonesia Barat · Data sesuai akses akun</span>
        </footer>
      </main>
    </div>
  );
}
