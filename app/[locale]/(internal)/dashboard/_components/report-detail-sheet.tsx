"use client";

import Gallery from "../../../_components/photo-gallery";
import MapView from "../../../_components/perimeter-map-view";
import type { ReportRecord } from "../../../_lib/client-api";
import { dateText, labels } from "../../../_lib/draft-store";

export function ReportStatusBadge({ report }: { report: ReportRecord }) {
  const statusKey = report.deletedAt ? "CLOSED" : report.status;
  return (
    <span className={`badge ${statusKey}`}>
      <i />
      {report.deletedAt ? "Ditutup" : labels[report.status] || report.status}
    </span>
  );
}

export interface ReportDetailSheetProps {
  report: ReportRecord;
  operator: boolean;
  onAction: (action: "STATUS" | "DELETE") => void;
  onBack: () => void;
}

export function ReportDetailSheet({
  report,
  operator,
  onAction,
  onBack,
}: ReportDetailSheetProps) {
  const findingLabel = report.findings?.length
    ? report.findings.map((f) => f.partName).join(", ")
    : `Perimeter sisi ${report.side || "belum ditentukan"}`;

  return (
    <article className="detail">
      <div className="section-heading">
        <button type="button" className="text-button" onClick={onBack}>
          ← Daftar laporan
        </button>
        <span className="reference">
          #{String(report.id).slice(-8).toUpperCase()}
        </span>
      </div>
      <ReportStatusBadge report={report} />
      <h2>{findingLabel}</h2>
      <p className="muted small">
        {report.reporterName || "Pelapor"} · {dateText(report.createdAt)}
      </p>
      <p className="narrative">{report.narrative}</p>
      <Gallery images={report.images} />
      {report.deletedAt && (
        <div className="closure">
          <strong>Laporan ditutup · {dateText(report.deletedAt)}</strong>
          <p className="narrative">{report.deletionReason}</p>
          <span>Status penanganan terakhir: {labels[report.status]}</span>
        </div>
      )}
      {!operator && (
        <>
          <h3>Lokasi laporan</h3>
          <MapView
            point={{ latitude: report.latitude, longitude: report.longitude }}
          />
          <p className="muted small">
            {report.latitude}, {report.longitude} ·{" "}
            {report.locationSource === "GPS" ? "GPS" : "Pin manual"}
            {report.gps?.accuracy != null
              ? ` · akurasi GPS ±${Math.round(report.gps.accuracy)} m`
              : ""}
          </p>
        </>
      )}
      {operator && !report.deletedAt && (
        <div className="detail-actions">
          <button type="button" onClick={() => onAction("STATUS")}>
            Perbarui status
          </button>
          <button
            type="button"
            className="danger-ghost"
            onClick={() => onAction("DELETE")}
          >
            Tutup laporan
          </button>
        </div>
      )}
      <section className="history">
        <h3>Riwayat penanganan</h3>
        {[...(report.history || [])].reverse().map((item) => (
          <div className="history-item" key={item.id}>
            <span className="history-dot" />
            <strong>
              {labels[item.status] ||
                (item.status === "DELETE" || item.status === "CLOSED"
                  ? "Ditutup"
                  : item.status) ||
                "Pembaruan laporan"}
            </strong>
            <p className="muted small">
              {item.actorName || "Petugas"} · {dateText(item.createdAt)}
            </p>
            {item.previousStatus && (
              <span className="small muted">
                Sebelumnya: {labels[item.previousStatus] || item.previousStatus}
              </span>
            )}
            <p className="narrative">{item.narrative}</p>
            <Gallery images={item.images} />
          </div>
        ))}
        <div className="history-item">
          <span className="history-dot" />
          <strong>Laporan dibuat</strong>
          <p className="muted small">
            {report.reporterName || "Pelapor"} · {dateText(report.createdAt)}
          </p>
        </div>
      </section>
    </article>
  );
}
