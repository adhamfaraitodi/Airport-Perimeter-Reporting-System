"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ClipboardClock,
  ClipboardPen,
  ClipboardCheck,
  ClipboardX,
  X,
  ZoomIn,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import MapView from "../../../../_components/perimeter-map-view";
import { api, type ImageRef, type ReportRecord } from "../../../../_lib/client-api";
import { dateText, message } from "../../../../_lib/draft-store";
import { btnText } from "../../../../_lib/ui-classes";

const states: Record<string, { label: string; icon: typeof ClipboardClock }> = {
  OPEN: { label: "Baru", icon: ClipboardClock },
  IN_PROGRESS: { label: "Ditangani", icon: ClipboardPen },
  RESOLVED: { label: "Selesai", icon: ClipboardCheck },
  CLOSED: { label: "Ditutup", icon: ClipboardX },
};

const button =
  "border-0 shadow-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--rd-link)]";
const heading = "m-0 mb-3 text-base leading-normal font-normal tracking-normal";
const small = "text-xs leading-relaxed text-[var(--rd-muted)]";

function timestamp(value?: string | null) {
  return value && !Number.isNaN(new Date(value).getTime())
    ? dateText(value)
    : "Waktu tidak tersedia";
}

function Status({ status }: { status: string }) {
  const item = states[status] || states.OPEN;
  return (
    <span
      data-status={states[status] ? status : "OPEN"}
      className="rd-status inline-flex items-center gap-1 rounded-full bg-[var(--rd-tint)] px-2 py-0.5 text-xs text-[var(--rd-status)]"
    >
      <span className="size-1.5 rounded-full bg-current" />
      {item.label}
    </span>
  );
}

interface PhotoItemProps {
  image: ImageRef;
  label: string;
  onOpen: (photo: { url: string; label: string }) => void;
}

function PhotoItem({ image, label, onOpen }: PhotoItemProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string | null | undefined>(image.url);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    if (visible && !url) {
      setError("");
      api
        .getImage({ imageId: image.id })
        .then((result) => {
          if (!active) return;
          if (!result.url) throw new Error("Foto belum tersedia.");
          setUrl(result.url);
        })
        .catch((err) => {
          if (active) setError(message(err));
        });
    }
    return () => {
      active = false;
    };
  }, [visible, image.id, url, retry]);

  return (
    <div
      ref={ref}
      className="relative flex aspect-square flex-col justify-end overflow-hidden rounded-lg border border-[var(--rd-border)] bg-[var(--rd-bg)]"
    >
      {url ? (
        <>
          <img src={url} alt={label} className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/60 p-1.5 text-xs text-white">
            <span className="truncate">{label}</span>
            <button
              type="button"
              onClick={() => onOpen({ url, label })}
              aria-label={`Buka foto ${label}`}
              className={`${button} flex min-h-7 items-center gap-1 rounded bg-[var(--rd-surface)]/20 px-1.5 py-0.5 text-[10px] text-white hover:bg-[var(--rd-surface)]/40`}
            >
              <ZoomIn size={12} aria-hidden="true" />
              Perbesar
            </button>
          </div>
        </>
      ) : error ? (
        <div className="flex h-full flex-col items-center justify-center p-2 text-center text-xs">
          <p className="m-0 mb-1 text-[var(--rd-coral)]">{error}</p>
          <button
            type="button"
            className={`${button} text-[var(--rd-link)]`}
            onClick={() => setRetry((x) => x + 1)}
          >
            Coba lagi
          </button>
        </div>
      ) : (
        <Skeleton className="h-full w-full rounded-lg" />
      )}
    </div>
  );
}

function Photos({
  images,
  onOpen,
}: {
  images?: ImageRef[];
  onOpen: (photo: { url: string; label: string }) => void;
}) {
  if (!images || !images.length) {
    return <p className={small}>Tidak ada foto yang dilampirkan.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {images.map((image, index) => (
        <PhotoItem
          key={image.id}
          image={image}
          label={`Foto ${index + 1}`}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

export interface ReportDetailProps {
  report: ReportRecord;
  onBack?: () => void;
}

export function ReportDetail({ report, onBack }: ReportDetailProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [photo, setPhoto] = useState<{ url: string; label: string } | null>(
    null
  );

  useEffect(() => {
    if (photo && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
    } else if (!photo && dialog.current?.open) {
      dialog.current.close();
    }
  }, [photo]);

  const findings = Array.isArray(report.findings) ? report.findings : [];
  const status = report.deletedAt ? "CLOSED" : report.status;
  const Icon = (states[status] || states.OPEN).icon;
  const history = [...(report.history || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const hasPoint =
    Number.isFinite(report.latitude) && Number.isFinite(report.longitude);

  return (
    <article className="rounded-2xl border-2 border-[var(--rd-border)] bg-[var(--rd-surface)] p-3.5 text-[var(--rd-text)] sm:p-6">
      {onBack && (
        <div className="mb-5 flex items-center justify-between gap-2.5">
          <button type="button" className={btnText} onClick={onBack}>
            <ArrowLeft size={16} aria-hidden="true" />
            Daftar laporan
          </button>
        </div>
      )}

      {/* Header bar */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--rd-border)] pb-4">
        <div className="flex items-start gap-3">
          <span
            data-status={states[status] ? status : "OPEN"}
            className="rd-status flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--rd-tint)] text-[var(--rd-status)]"
          >
            <Icon size={24} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className={small}>
                #{String(report.id).slice(-6).toUpperCase()}
              </span>
              <Status status={status} />
            </div>
            <h2 className="m-0 text-base font-normal tracking-normal sm:text-lg">
              {findings.map((item) => item.partName).join(", ") ||
                "Laporan Perimeter"}
            </h2>
            {(report.segmentCode || report.side) && (
              <p className={`${small} m-0 mt-0.5 font-medium text-[var(--rd-link)]`}>
                {report.segmentCode ? `Grid ${report.segmentCode}` : ""}
                {report.segmentCode && report.side ? " · " : ""}
                {report.side ? `Sisi ${report.side}` : ""}
              </p>
            )}
            <p className={`${small} m-0 mt-1`}>
              Dilaporkan {timestamp(report.createdAt)} · Diperbarui{" "}
              {timestamp((report as any).updatedAt || report.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* 2-Column Split on Desktop so detail view utilizes wide screen cleanly */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* LEFT COLUMN: Findings, Narrative & Photos */}
        <div className="space-y-5 lg:col-span-7">
          {report.deletedAt && (
            <section
              aria-labelledby="closed-heading"
              className="rounded-lg border border-[var(--rd-border)] bg-[var(--rd-bg)] p-3"
            >
              <h3 id="closed-heading" className={heading}>
                Laporan ditutup
              </h3>
              <p className={`${small} m-0 mb-2`}>
                Penutupan menyembunyikan laporan dari tampilan aktif tanpa
                menghapus riwayat dan bukti.
              </p>
              <p className="m-0 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
                {(report as any).deleteReason || report.deletionReason || "Alasan penutupan tidak tercatat."}
              </p>
            </section>
          )}

          <section aria-labelledby="findings-heading">
            <h3 id="findings-heading" className={heading}>
              Bagian Pagar & Jenis Kerusakan
            </h3>
            {findings.length ? (
              <div className="space-y-3">
                {findings.map((finding) => (
                  <div
                    key={finding.partId || finding.partName}
                    className="rounded-lg border border-[var(--rd-border)] p-3"
                  >
                    <p className="m-0 mb-2 text-xs text-[var(--rd-muted)]">
                      {finding.partName}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(finding.damages || []).map((damage) => {
                        const name =
                          typeof damage === "string" ? damage : damage.name;
                        const key =
                          typeof damage === "string" ? damage : damage.id;
                        return (
                          <span
                            key={key}
                            className="inline-flex min-h-7 items-center gap-1 rounded-lg bg-[var(--rd-active)] px-2 py-1 text-xs text-[var(--rd-link)]"
                          >
                            <Check size={14} aria-hidden="true" />
                            {name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={small}>Tidak ada bagian pagar tercatat.</p>
            )}
          </section>

          <section aria-labelledby="narrative-heading">
            <h3 id="narrative-heading" className={heading}>
              Narasi Laporan Temuan
            </h3>
            <p className="m-0 rounded-lg border border-[var(--rd-border)] bg-[var(--rd-bg)]/50 p-3.5 text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
              {report.narrative || "Tidak ada narasi."}
            </p>
          </section>

          <section aria-labelledby="photos-heading">
            <h3 id="photos-heading" className={heading}>
              Foto-foto Laporan Temuan
            </h3>
            <Photos images={report.images} onOpen={setPhoto} />
          </section>
        </div>

        {/* RIGHT COLUMN: Map Location & Status History */}
        <div className="space-y-5 lg:col-span-5">
          <section aria-labelledby="location-heading">
            <h3 id="location-heading" className={heading}>
              Lokasi kejadian
            </h3>
            {hasPoint ? (
              <>
                <MapView
                  editable={false}
                  point={{
                    latitude: report.latitude,
                    longitude: report.longitude,
                  }}
                />
                <p className={`${small} mt-2 mb-0`}>
                  {report.segmentCode ? `Grid ${report.segmentCode} · ` : ""}
                  {report.side ? `Sisi ${report.side} · ` : ""}
                  {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)} ·{" "}
                  {report.locationSource === "GPS" ? "GPS" : "Pin manual"}
                </p>
                {report.gps && (
                  <p className={`${small} mt-1 mb-0`}>
                    GPS asli: {report.gps.latitude.toFixed(6)},{" "}
                    {report.gps.longitude.toFixed(6)} · akurasi ±
                    {Math.round(report.gps.accuracy)} m
                  </p>
                )}
              </>
            ) : (
              <p className={small}>Lokasi tidak tersedia.</p>
            )}
          </section>

          <section aria-labelledby="history-heading">
            <h3 id="history-heading" className={heading}>
              Riwayat pembaruan
            </h3>
            <ol className="m-0 list-none space-y-4 p-0">
              {history.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-[var(--rd-border)] p-3"
                >
                  <Status
                    status={
                      item.status === "DELETE" || item.status === "CLOSED"
                        ? "CLOSED"
                        : item.status
                    }
                  />
                  <p className={`${small} mt-2 mb-2`}>
                    {item.actorName || "Petugas"} · {timestamp(item.createdAt)}
                  </p>
                  {item.previousStatus && (
                    <p className={`${small} mb-2`}>
                      Sebelumnya:{" "}
                      {states[item.previousStatus]?.label ||
                        item.previousStatus}
                    </p>
                  )}
                  <p className="mt-0 mb-3 text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {item.narrative}
                  </p>
                  <Photos images={item.images} onOpen={setPhoto} />
                </li>
              ))}
              <li className="border-l-2 border-[var(--rd-link)] pl-3">
                <p className="m-0 text-sm">Laporan dibuat</p>
                <p className={`${small} mt-1 mb-0`}>
                  {report.reporterName || "Pelapor"} ·{" "}
                  {timestamp(report.createdAt)}
                </p>
              </li>
            </ol>
          </section>
        </div>
      </div>

      <dialog
        ref={dialog}
        onCancel={() => setPhoto(null)}
        onClose={() => setPhoto(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setPhoto(null);
        }}
        aria-label={photo?.label || "Pratinjau foto"}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_32px)] max-w-4xl overflow-auto rounded-xl border border-[var(--rd-border)] bg-[var(--rd-surface)] p-4 text-[var(--rd-text)] shadow-xl backdrop:bg-black/70"
      >
        <div className="mb-3 flex items-center justify-between gap-4">
          <span className="text-sm">{photo?.label}</span>
          <button
            autoFocus
            type="button"
            onClick={() => setPhoto(null)}
            aria-label="Tutup foto"
            className={`${button} grid size-10 place-items-center rounded-full bg-[var(--rd-bg)] p-0 text-[var(--rd-muted)] transition-all duration-200 hover:bg-[var(--rd-coral)]/15 hover:text-[var(--rd-coral)] active:bg-[var(--rd-coral)]/20 active:text-[var(--rd-coral)] active:duration-0 max-sm:active:scale-95`}
          >
            <X size={22} />
          </button>
        </div>
        {photo && (
          <img
            src={photo.url}
            alt={photo.label}
            className="mx-auto max-h-[72dvh] w-full object-contain"
          />
        )}
      </dialog>
    </article>
  );
}
