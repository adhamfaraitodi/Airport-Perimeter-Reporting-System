"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import Gallery from "../../../_components/photo-gallery";
import MapView from "../../../_components/perimeter-map-view";
import type { ReportRecord } from "../../../_lib/client-api";
import { dateText, labels } from "../../../_lib/draft-store";
import {
  btnDangerGhost,
  btnPrimary,
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
  onAction: (action: "STATUS" | "DELETE") => void;
  onBack: () => void;
}

const narrative =
  "mb-4 whitespace-pre-wrap text-[13px] leading-[1.85] [overflow-wrap:anywhere]";
const heading = "mb-3 text-[15px] font-semibold leading-normal";

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
      <div className="mb-3.5">
        <ReportStatusBadge report={report} />
      </div>
      <h2 className="mb-2.5 text-[21px] leading-snug font-semibold md:text-[23px]">
        {findingLabel}
      </h2>
      <p className={`${mutedText} mb-4`}>
        {report.reporterName || "Pelapor"} · {dateText(report.createdAt)}
      </p>
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
          <button
            type="button"
            className={`${btnPrimary} flex-1 text-xs`}
            onClick={() => onAction("STATUS")}
          >
            Perbarui status
          </button>
          <button
            type="button"
            className={`${btnDangerGhost} flex-1 text-xs`}
            onClick={() => onAction("DELETE")}
          >
            Tutup laporan
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
              <p className={narrative}>{item.narrative}</p>
              <Gallery images={item.images} />
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
    <li className="relative ml-[5px] border-l border-solid border-[var(--rd-border)] pb-5 pl-[23px] text-xs last:border-transparent">
      <span
        aria-hidden="true"
        className="absolute top-0.5 -left-[5px] size-[9px] rounded-full border-2 border-solid border-[var(--rd-surface)] bg-[var(--rd-link)] outline-1 outline-solid outline-[var(--rd-border)]"
      />
      {children}
    </li>
  );
}
