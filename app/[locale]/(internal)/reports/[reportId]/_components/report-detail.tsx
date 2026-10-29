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
  return (
    <span
      data-status={status}
      className="rd-status inline-flex items-center gap-1 rounded-full bg-[var(--rd-tint)] px-2 py-0.5 text-[10px] text-[var(--rd-status)]"
    >
      <span className="size-1.5 rounded-full bg-current" />
      {states[status]?.label || status || "Status tidak tersedia"}
    </span>
  );
}

function Photo({
  image,
  index,
  onOpen,
}: {
  image: ImageRef;
  index: number;
  onOpen: (item: { url: string; label: string }) => void;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.IntersectionObserver) {
      setVisible(true);
      return;
    }
    if (!host.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" }
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setUrl(null);
    setError("");
    const request = image.url
      ? Promise.resolve({ url: image.url })
      : api.getImage({ imageId: image.id });
    request
      .then((result) => {
        if (
          !result?.url ||
          !/^(data:image\/(jpeg|png|webp);base64,|blob:|https:\/\/)/i.test(
            result.url
          )
        ) {
          throw new Error("Foto tidak tersedia.");
        }
        if (active) setUrl(result.url);
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [image.id, image.url, visible, retry]);

  return (
    <div
      ref={host}
      className="aspect-square overflow-hidden rounded-lg border border-[var(--rd-border)] bg-[var(--rd-bg)]"
    >
      {error ? (
        <button
          type="button"
          className={`${button} h-full w-full bg-transparent p-3 text-xs font-normal text-[var(--rd-coral)]`}
          onClick={() => setRetry((value) => value + 1)}
        >
          {error}
          <span className="mt-2 block underline">Coba lagi</span>
        </button>
      ) : url ? (
        <button
          type="button"
          className={`${button} group relative block h-full w-full rounded-none bg-transparent p-0`}
          aria-label={`Perbesar foto bukti ${index + 1}`}
          onClick={() => onOpen({ url, label: `Foto bukti ${index + 1}` })}
        >
          <img
            src={url}
            alt={`Foto bukti ${index + 1}`}
            loading="lazy"
            onError={() => setError("Foto gagal dimuat.")}
            className="h-full w-full object-cover"
          />
          <span className="absolute right-2 bottom-2 rounded-full bg-black/50 p-1.5 text-white">
            <ZoomIn size={15} aria-hidden="true" />
          </span>
        </button>
      ) : (
        <Skeleton className="h-full w-full rounded-lg" />
      )}
    </div>
  );
}

function Photos({
  images = [],
  onOpen,
}: {
  images?: ImageRef[];
  onOpen: (item: { url: string; label: string }) => void;
}) {
  return images.length ? (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((image, index) => (
        <Photo
          key={image.id || image.url || index}
          image={image}
          index={index}
          onOpen={onOpen}
        />
      ))}
    </div>
  ) : (
    <p className={small}>Belum ada foto.</p>
  );
}

export interface ReportDetailProps {
  report: ReportRecord | null;
  onBack?: () => void;
}

export function ReportDetail({ report, onBack }: ReportDetailProps) {
  const [photo, setPhoto] = useState<{ url: string; label: string } | null>(
    null
  );
  const dialog = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    if (!dialog.current) return;
    if (photo && !dialog.current.open) dialog.current.showModal();
    if (!photo && dialog.current.open) dialog.current.close();
  }, [photo]);

  if (!report) {
    return (
      <div className="rounded-xl border border-[var(--rd-border)] bg-[var(--rd-surface)] p-6 text-sm text-[var(--rd-muted)]">
        Laporan tidak ditemukan.
      </div>
    );
  }

  const status = report.deletedAt ? "CLOSED" : report.status;
  const Icon = states[status]?.icon || ClipboardClock;
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const hasPoint =
    Number.isFinite(report.latitude) && Number.isFinite(report.longitude);
  const history = [...(report.history || [])].reverse();

  return (
    <article
      aria-labelledby="report-detail-title"
      className="rounded-xl border-2 border-[var(--rd-border)] bg-[var(--rd-surface)] p-3.5 text-[var(--rd-text)] sm:p-6"
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className={`${button} mb-6 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-transparent px-0 py-1 text-xs text-[var(--rd-muted)] hover:text-[var(--rd-link)]`}
        >
          <ArrowLeft
            size={18}
            className="text-[var(--rd-link)]"
            aria-hidden="true"
          />
          Daftar Laporan
        </button>
      )}
      <div className="mb-8 flex items-center gap-4">
        <span
          data-status={status}
          className="rd-status grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--rd-tint)] text-[var(--rd-status)]"
        >
          <Icon size={29} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2
            id="report-detail-title"
            className="m-0 mb-1 flex flex-wrap gap-x-2 text-base font-normal tracking-normal"
          >
            Detail laporan{" "}
            <span className="text-[var(--rd-link)]" title={report.id}>
              #{String(report.id).slice(-6).toUpperCase()}
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Status status={status} />
            <time dateTime={report.createdAt} className="text-[10px]">
              {timestamp(report.createdAt)}
            </time>
          </div>
        </div>
      </div>
      {report.deletedAt && (
        <section
          aria-label="Keterangan penutupan"
          className="mb-7 rounded-lg border border-[var(--rd-border)] bg-[var(--rd-bg)] p-4"
        >
          <h3 className={heading}>Laporan ditutup</h3>
          <p className={`${small} mb-2`}>
            {timestamp(report.deletedAt)} · Status terakhir:{" "}
            {states[report.status]?.label || report.status}
          </p>
          <p className="m-0 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
            {report.deletionReason || "Keterangan penutupan belum tersedia."}
          </p>
          <p className={`${small} mt-2 mb-0`}>
            Penutupan administratif tidak berarti masalah sudah selesai
            ditangani. Foto bukti penutupan tersedia pada riwayat jika
            dilampirkan.
          </p>
        </section>
      )}
      <section className="mb-6">
        <h3 className={heading}>Bagian dan Jenis Kerusakan</h3>
        <div className="space-y-3">
          {findings.length ? (
            findings.map((finding, index) => (
              <div
                key={finding.partId || index}
                className="rounded-lg border border-[var(--rd-border)] p-3"
              >
                <h4 className="m-0 mb-3 text-sm font-normal">
                  {finding.partName || "Bagian tidak tersedia"}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(finding.damages || []).map((damage, i) => (
                    <span
                      key={typeof damage === "string" ? damage : damage.id || i}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--rd-active)] px-2 py-1 text-xs text-[var(--rd-link)]"
                    >
                      <Check size={15} aria-hidden="true" />
                      {typeof damage === "string" ? damage : damage.name}
                    </span>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className={small}>
              Data bagian dan jenis kerusakan belum tersedia pada laporan ini.
            </p>
          )}
        </div>
      </section>
      <section className="mb-6">
        <h3 className={heading}>Narasi Laporan Temuan</h3>
        <p className="m-0 min-h-24 rounded-lg border border-[var(--rd-border)] p-3 text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
          {report.narrative || "Tidak ada narasi."}
        </p>
      </section>
      <section className="mb-6">
        <h3 className={heading}>Foto-foto Laporan Temuan</h3>
        <Photos images={report.images} onOpen={setPhoto} />
      </section>
      <section className="mb-7">
        <h3 className={heading}>Lokasi kejadian</h3>
        <p className={`${small} mb-2`}>
          {report.segmentCode
            ? `Segmen ${report.segmentCode}`
            : "Segmen belum dipetakan"}
          {report.side ? ` · Sisi ${report.side}` : ""}
          {hasPoint
            ? ` · ${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}`
            : ""}{" "}
          ·{" "}
          {report.locationSource === "GPS"
            ? "GPS"
            : report.locationSource === "MANUAL"
              ? "Pin manual"
              : "Sumber lokasi tidak tersedia"}
        </p>
        {hasPoint ? (
          <MapView
            point={{ latitude: report.latitude, longitude: report.longitude }}
           
          />
        ) : (
          <p className={small}>Koordinat laporan belum tersedia.</p>
        )}
        {Number.isFinite(report.gps?.accuracy) && (
          <p className={`${small} mt-2 mb-0`}>
            Akurasi GPS awal ±{Math.round(report.gps!.accuracy)} meter.
          </p>
        )}
      </section>
      <section className="border-t border-[var(--rd-border)] pt-5">
        <h3 className={heading}>Riwayat penanganan</h3>
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
                  {states[item.previousStatus]?.label || item.previousStatus}
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
              {report.reporterName || "Pelapor"} · {timestamp(report.createdAt)}
            </p>
          </li>
        </ol>
      </section>
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
            className={`${button} grid size-10 place-items-center rounded-full bg-[var(--rd-bg)] p-0 text-[var(--rd-text)]`}
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
