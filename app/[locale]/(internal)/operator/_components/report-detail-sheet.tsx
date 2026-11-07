"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeft, Check, Download, Loader2, MapPin } from "lucide-react";
import Gallery from "../../../_components/photo-gallery";
import MapView from "../../../_components/perimeter-map-view";
import type { ReportRecord } from "../../../_lib/client-api";
import { dateText, labels } from "../../../_lib/draft-store";
import { downloadReportDocument } from "../../../_lib/report-document";
import {
  btnBase,
  btnDangerGhost,
  btnPrimary,
  btnSecondary,
  btnText,
  mutedText,
  statusPill,
} from "../../../_lib/ui-classes";

export function ReportStatusBadge({ report }: { report: ReportRecord }) {
  const statusKey = report.deletedAt ? "CLOSED" : report.status;
  return (
    <span data-status={statusKey} className={statusPill}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {report.deletedAt ? "Ditutup" : labels[report.status] || report.status}
    </span>
  );
}

export interface ReportDetailSheetProps {
  report: ReportRecord;
  operator: boolean;
  canDelete?: boolean;
  canUpdateStatus?: boolean;
  statusActionLabel?: string;
  statusActionDisabled?: boolean;
  onAction?: (action: "STATUS" | "DELETE") => void;
  onBack: () => void;
}

const narrative =
  "mb-4 whitespace-pre-wrap text-[13px] leading-[1.85] [overflow-wrap:anywhere]";
const heading = "mb-3 text-[15px] font-semibold leading-normal";

export function ReportDetailSheet({
  report,
  operator,
  canDelete = true,
  canUpdateStatus = false,
  statusActionLabel = "Perbarui status",
  statusActionDisabled = false,
  onAction,
  onBack,
}: ReportDetailSheetProps) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  async function handleDownloadPdf() {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      await downloadReportDocument(report);
    } finally {
      setDownloadingPdf(false);
    }
  }

  const findingLabel = report.findings?.length
    ? report.findings.map((f) => f.partName).join(", ")
    : `Perimeter sisi ${report.side || "belum ditentukan"}`;
  const findings = Array.isArray(report.findings) ? report.findings : [];

  return (
    <article className="px-[18px] py-[21px] md:p-[26px]">
      <div className="mb-5 flex items-center justify-between gap-2.5">
        <button type="button" className={btnText} onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          Daftar laporan
        </button>
        <span className="text-[10px] tracking-[0.9px] text-[var(--rd-muted)]">
          #{String(report.id).slice(-8).toUpperCase()}
        </span>
      </div>
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <ReportStatusBadge report={report} />
        {(report.segmentCode || report.side) && (
          <span className="inline-flex items-center gap-1 rounded-full border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--rd-text)]">
            <MapPin size={12} className="text-[var(--rd-link)]" aria-hidden="true" />
            {report.segmentCode ? `Grid ${report.segmentCode}` : ""}
            {report.segmentCode && report.side ? " · " : ""}
            {report.side ? `Sisi ${report.side}` : ""}
          </span>
        )}
      </div>
      <h2 className="mb-2.5 text-[21px] leading-snug font-semibold md:text-[23px]">
        {findingLabel}
      </h2>
      <p className={`${mutedText} mb-4`}>
        {report.reporterName || "Pelapor"} · {dateText(report.createdAt)}
      </p>
      {findings.length > 0 && (
        <div className="mb-4 space-y-2">
          {findings.map((finding, index) => (
            <div
              key={finding.partId || index}
              className="rounded-lg border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)]/60 p-2.5"
            >
              <div className="mb-1.5 text-xs font-semibold text-[var(--rd-text)]">
                {finding.partName}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(finding.damages || []).map((damage, i) => (
                  <span
                    key={typeof damage === "string" ? damage : damage.id || i}
                    className="inline-flex items-center gap-1 rounded-md bg-[var(--rd-active)] px-2 py-0.5 text-[11px] font-medium text-[var(--rd-link)]"
                  >
                    <Check size={12} aria-hidden="true" />
                    {typeof damage === "string" ? damage : damage.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className={narrative}>{report.narrative}</p>
      <Gallery images={report.images} />
      {report.deletedAt && (
        <div className="my-5 border-l-[3px] border-solid border-[var(--rd-brown)] bg-[var(--rd-bg)] p-[15px] text-xs">
          <strong>Laporan ditutup · {dateText(report.deletedAt)}</strong>
          <p className={`${narrative} mt-2.5`}>{report.deletionReason}</p>
          <span>Status penanganan terakhir: {labels[report.status]}</span>
        </div>
      )}
      {!operator && (
        <>
          <h3 className={heading}>Lokasi laporan</h3>
          <MapView
            point={{ latitude: report.latitude, longitude: report.longitude }}
          />
          <p className={`${mutedText} mt-2`}>
            {report.latitude}, {report.longitude} ·{" "}
            {report.locationSource === "GPS" ? "GPS" : "Pin manual"}
            {report.gps?.accuracy != null
              ? ` · akurasi GPS ±${Math.round(report.gps.accuracy)} m`
              : ""}
          </p>
        </>
      )}
      {operator && !report.deletedAt && (
        <div className="my-5 flex flex-wrap gap-2">
          {canUpdateStatus && onAction && (
            <button
              type="button"
              disabled={statusActionDisabled}
              className={`${
                statusActionDisabled
                  ? `${btnBase} min-h-10 flex-1 border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)]/70 px-4 py-2 text-xs font-semibold text-[var(--rd-muted)] cursor-not-allowed opacity-60 shadow-none`
                  : `${btnPrimary} flex-1 text-xs`
              }`}
              onClick={() => {
                if (!statusActionDisabled) {
                  onAction("STATUS");
                }
              }}
            >
              {statusActionLabel}
            </button>
          )}
          <button
            type="button"
            disabled={downloadingPdf}
            className={`${canUpdateStatus && !statusActionDisabled ? btnSecondary : btnPrimary} flex-1 text-xs disabled:cursor-not-allowed disabled:opacity-60`}
            onClick={handleDownloadPdf}
          >
            {downloadingPdf ? (
              <Loader2 size={14} className="mr-1.5 animate-spin" aria-hidden="true" />
            ) : (
              <Download size={14} className="mr-1.5" aria-hidden="true" />
            )}
            {downloadingPdf ? "Menyiapkan PDF…" : "Unduh Laporan"}
          </button>
          {canDelete && onAction && (
            <button
              type="button"
              className={`${btnDangerGhost} flex-1 text-xs`}
              onClick={() => onAction("DELETE")}
            >
              Tutup laporan
            </button>
          )}
        </div>
      )}
      {operator && report.deletedAt && (
        <div className="my-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={downloadingPdf}
            className={`${btnPrimary} flex-1 text-xs disabled:cursor-not-allowed disabled:opacity-60`}
            onClick={handleDownloadPdf}
          >
            {downloadingPdf ? (
              <Loader2 size={14} className="mr-1.5 animate-spin" aria-hidden="true" />
            ) : (
              <Download size={14} className="mr-1.5" aria-hidden="true" />
            )}
            {downloadingPdf ? "Menyiapkan PDF…" : "Unduh Arsip Laporan"}
          </button>
        </div>
      )}
      <section className="mt-7 border-t border-solid border-[var(--rd-border)] pt-[22px]">
        <h3 className={heading}>Riwayat penanganan</h3>
        <ol className="m-0 list-none p-0">
          {[...(report.history || [])].reverse().map((item) => (
            <HistoryItem key={item.id}>
              <strong>
                {labels[item.status] ||
                  (item.status === "DELETE" || item.status === "CLOSED"
                    ? "Ditutup"
                    : item.status) ||
                  "Pembaruan laporan"}
              </strong>
              <p className={`${mutedText} mt-1.5 mb-2.5`}>
                {item.actorName || "Petugas"} · {dateText(item.createdAt)}
              </p>
              {item.previousStatus && (
                <span className={`${mutedText} mb-2 block`}>
                  Sebelumnya: {labels[item.previousStatus] || item.previousStatus}
                </span>
              )}
              {item.narrative && <p className={narrative}>{item.narrative}</p>}
              {item.images?.length > 0 && <Gallery images={item.images} />}
            </HistoryItem>
          ))}
          <HistoryItem>
            <strong>Laporan dibuat</strong>
            <p className={`${mutedText} mt-1.5 mb-0`}>
              {report.reporterName || "Pelapor"} · {dateText(report.createdAt)}
            </p>
          </HistoryItem>
        </ol>
      </section>
    </article>
  );
}

function HistoryItem({ children }: { children: ReactNode }) {
  return (
    <li className="relative border-l border-solid border-[var(--rd-border)] pb-5 pl-[18px] last:pb-0">
      <span
        className="absolute top-1 -left-[5px] size-[9px] rounded-full border-2 border-solid border-[var(--rd-surface)] bg-[var(--rd-link)]"
        aria-hidden="true"
      />
      {children}
    </li>
  );
}
