"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { LocateFixed, Plus, X } from "lucide-react";
import {
  api,
  type BeginSubmissionPayload,
  type GpsPoint,
  type LifecycleStatus,
  type ReportRecord,
  type SessionUser,
} from "../../../_lib/client-api";
import {
  countText,
  labels,
  message,
  newId,
  useDrafts,
} from "../../../_lib/draft-store";
import MapView, {
  isPointInNavigationBounds,
  type LatLngPoint,
} from "../../../_components/perimeter-map-view";
import {
  alertBox,
  btnDanger,
  btnDangerGhost,
  btnIcon,
  btnPrimary,
  btnSecondary,
  btnText,
  eyebrow,
  fieldControl,
  fieldLabel,
  focusRing,
  mutedText,
} from "../../../_lib/ui-classes";

const sides = [
  "Utara",
  "Timur Laut",
  "Timur",
  "Tenggara",
  "Selatan",
  "Barat Daya",
  "Barat",
  "Barat Laut",
];

/** Buttons stretch to full width on mobile, natural width from `md`. */
const formActions = "flex justify-end gap-2.5 *:max-md:flex-1";

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () =>
      reject(
        new Error(
          "Foto tidak dapat dibaca. Coba pilih ulang atau kirim kembali."
        )
      );
    reader.readAsDataURL(file);
  });
}

interface PendingFile {
  id: string;
  file: File;
  preview: string;
}

export interface SubmissionFormProps {
  user: SessionUser;
  report?: ReportRecord | null;
  action?: "CREATE" | "STATUS" | "DELETE";
  onSuccess: (report: ReportRecord) => void;
  onCancel: (options?: { abandonedSubmissionId?: string }) => void;
  onLock: (locked: boolean) => void;
}

export function UpdateStatusDialog({
  user,
  report,
  action = "STATUS",
  onSuccess,
  onCancel,
  onLock,
}: SubmissionFormProps) {
  const key = `${user.id}:${action}:${report?.id || "new"}`;
  const draft = useDrafts((state) => state.drafts[key]);
  const update = useDrafts((state) => state.update);
  const clear = useDrafts((state) => state.clear);
  const narrative = draft?.narrative || "";
  const side = draft?.side || "";

  const [status, setStatus] = useState<LifecycleStatus>(
    report?.status === "RESOLVED"
      ? "OPEN"
      : report?.status === "OPEN"
        ? "IN_PROGRESS"
        : "RESOLVED"
  );
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [point, setPoint] = useState<LatLngPoint | null>(null);
  const [gps, setGps] = useState<GpsPoint | null>(null);
  const [source, setSource] = useState<"GPS" | "MANUAL">("MANUAL");
  const [gpsMessage, setGpsMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState<BeginSubmissionPayload | null>(null);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  const filesRef = useRef<PendingFile[]>([]);
  const lock = useRef(false);
  const mounted = useRef(true);
  const manual = useRef(false);
  const inFlight = useRef(false);
  const attemptRef = useRef<BeginSubmissionPayload | null>(null);
  const frozen = !!attempt || busy;

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      filesRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, []);

  useEffect(() => {
    onLock(frozen);
  }, [frozen, onLock]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (lock.current || filesRef.current.length) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function locate() {
    if (!navigator.geolocation) {
      setGpsMessage("GPS tidak tersedia. Ketuk peta untuk memilih lokasi.");
      return;
    }
    setGpsMessage("Mencari lokasi GPS…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!mounted.current || lock.current) return;
        const location: GpsPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setGps(location);
        if (!manual.current) {
          setPoint({
            latitude: location.latitude,
            longitude: location.longitude,
          });
          setSource("GPS");
        }
        setGpsMessage(
          `GPS tercatat · akurasi ±${Math.round(location.accuracy)} m${
            isPointInNavigationBounds(location)
              ? ""
              : ". GPS berada di luar jangkauan peta. Koordinat asli tetap disimpan; ketuk peta bila lokasi kejadian perlu dikoreksi."
          }`
        );
      },
      () => {
        if (mounted.current && !lock.current) {
          setGpsMessage(
            "GPS tidak dapat diakses. Ketuk peta untuk memilih lokasi manual."
          );
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  useEffect(() => {
    if (action === "CREATE") locate();
  }, [action]);

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const accepted: PendingFile[] = [];
    const errors: string[] = [];
    for (const file of Array.from(event.target.files || [])) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        errors.push(`${file.name}: gunakan JPG, PNG, atau WebP.`);
        continue;
      }
      if (file.size > 3000000 || file.size === 0) {
        errors.push(
          `${file.name}: foto harus berisi data dan maksimal 3.000.000 byte.`
        );
        continue;
      }
      accepted.push({ id: newId(), file, preview: URL.createObjectURL(file) });
    }
    setFiles((old) => [...old, ...accepted]);
    setError(errors.join(" "));
    event.target.value = "";
  }

  function abandon() {
    if (inFlight.current || !attemptRef.current || !confirmAbandon) return;
    const submissionId = attemptRef.current.id;
    attemptRef.current = null;
    lock.current = false;
    onLock(false);
    onCancel({ abandonedSubmissionId: submissionId });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || confirmAbandon) return;
    inFlight.current = true;
    setError("");
    try {
      if (
        !attemptRef.current &&
        (!narrative.trim() ||
          countText(narrative) > 2000 ||
          !files.length ||
          (action === "CREATE" && (!point || !side)))
      ) {
        setError(
          "Lengkapi narasi (maksimal 2.000 karakter), minimal satu foto, serta sisi dan lokasi untuk laporan baru."
        );
        return;
      }
      const transaction: BeginSubmissionPayload = attemptRef.current || {
        id: newId(),
        action,
        ...(report
          ? { reportId: report.id, expectedStatus: report.status }
          : {}),
        ...(action === "STATUS" ? { status } : {}),
        narrative: narrative.trim(),
        ...(action === "CREATE" && point
          ? {
              side,
              latitude: point.latitude,
              longitude: point.longitude,
              gps,
              locationSource: source,
            }
          : {}),
        expectedImageIds: files.map((item) => item.id),
      };
      attemptRef.current = transaction;
      lock.current = true;
      setAttempt(transaction);
      setBusy(true);
      onLock(true);
      const submission = await api.beginSubmission(transaction);
      for (const item of files) {
        setProgress((old) => ({ ...old, [item.id]: "Mengunggah" }));
        try {
          await api.uploadImage({
            submissionId: submission.id,
            imageId: item.id,
            name: item.file.name,
            mimeType: item.file.type,
            base64: await readBase64(item.file),
          });
          setProgress((old) => ({ ...old, [item.id]: "Berhasil" }));
        } catch (uploadError) {
          setProgress((old) => ({ ...old, [item.id]: "Gagal" }));
          throw uploadError;
        }
      }
      const updated = await api.finalizeSubmission({
        submissionId: submission.id,
      });
      clear(key);
      lock.current = false;
      onLock(false);
      onSuccess(updated);
    } catch (e) {
      setError(message(e));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const overLimit = countText(narrative) > 2000;

  return (
    <form className="px-[18px] py-[21px] md:p-[26px]" onSubmit={submit}>
      <div className="mb-5 flex items-center justify-between gap-2.5">
        <div>
          <span className={eyebrow}>
            {action === "CREATE"
              ? "PELAPORAN LAPANGAN"
              : user.role === "TECHNICIAN"
                ? "TINDAK LANJUT TEKNISI"
                : "TINDAKAN OPERATOR"}
          </span>
          <h2 className="m-0 text-[21px] leading-snug font-semibold md:text-[23px]">
            {action === "CREATE"
              ? "Buat laporan baru"
              : action === "DELETE"
                ? "Tutup laporan"
                : "Perbarui penanganan"}
          </h2>
        </div>
        {!frozen && (
          <button
            type="button"
            className={`${btnIcon} transition-colors hover:!bg-[var(--rd-coral)]/15 hover:!text-[var(--rd-coral)]`}
            aria-label="Tutup formulir"
            onClick={() => onCancel()}
          >
            <X size={20} aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="mb-5 text-sm leading-relaxed text-[var(--rd-muted)]">
        {action === "DELETE"
          ? "Penutupan menyembunyikan titik dari peta, bukan menghapus bukti atau menyatakan masalah selesai."
          : "Informasi yang jelas membantu tim menindaklanjuti kondisi perimeter."}
      </p>
      <fieldset
        disabled={frozen}
        className="m-0 min-w-0 border-0 p-0 disabled:opacity-70"
      >
        {action === "STATUS" && report && (
          <label className={fieldLabel}>
            Status berikutnya
            <select
              className={fieldControl}
              value={status}
              onChange={(e) => setStatus(e.target.value as LifecycleStatus)}
            >
              {(report.status === "RESOLVED"
                ? (["OPEN"] as const)
                : report.status === "OPEN"
                  ? (["IN_PROGRESS", "RESOLVED"] as const)
                  : (["RESOLVED"] as const)
              ).map((value) => (
                <option key={value} value={value}>
                  {labels[value]}
                </option>
              ))}
            </select>
          </label>
        )}
        {action === "CREATE" && (
          <label className={fieldLabel}>
            Sisi perimeter
            <select
              className={fieldControl}
              value={side}
              onChange={(e) => update(key, { side: e.target.value })}
            >
              <option value="">Pilih sisi lokasi</option>
              {sides.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        )}
        <label className={fieldLabel}>
          {action === "DELETE"
            ? "Alasan penutupan"
            : "Narasi laporan / tindakan"}
          <textarea
            rows={5}
            className={`${fieldControl} leading-[1.65]`}
            value={narrative}
            onChange={(e) => update(key, { narrative: e.target.value })}
            placeholder="Jelaskan kondisi, titik patokan, dan tindakan yang diperlukan."
            aria-describedby="narrative-count"
          />
        </label>
        <div
          id="narrative-count"
          className={`-mt-2.5 mb-5 text-right text-[10px] ${
            overLimit ? "text-[var(--rd-coral)]" : "text-[var(--rd-muted)]"
          }`}
        >
          {countText(narrative).toLocaleString("id-ID")} / 2.000 karakter
        </div>
        <label className="relative mb-[18px] flex min-h-[145px] cursor-pointer flex-col items-center justify-center gap-[7px] overflow-hidden rounded-[10px] border border-dashed border-[var(--rd-link)]/50 bg-[var(--rd-bg)] p-5 text-center text-xs font-semibold focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--rd-link)]">
          <Plus
            size={28}
            className="text-[var(--rd-link)]"
            aria-hidden="true"
          />
          <strong>Tambahkan foto bukti</strong>
          <span className="text-[10px] font-normal text-[var(--rd-muted)]">
            JPG, PNG, WebP · maksimal 3 MB per foto
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={selectFiles}
            className="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        {!!files.length && (
          <div className="mb-5 grid grid-cols-3 gap-2">
            {files.map((item) => (
              <div
                className="relative aspect-square overflow-hidden rounded-lg bg-[var(--rd-bg)]"
                key={item.id}
              >
                <img
                  src={item.preview}
                  alt={item.file.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  aria-label={`Hapus ${item.file.name}`}
                  className={`absolute top-1 right-1 grid size-8 place-items-center rounded-full bg-[var(--rd-surface)]/90 p-0 text-[var(--rd-muted)] transition-colors hover:bg-[var(--rd-coral)]/15 hover:text-[var(--rd-coral)] ${focusRing}`}
                  onClick={() => {
                    URL.revokeObjectURL(item.preview);
                    setFiles((old) =>
                      old.filter((file) => file.id !== item.id)
                    );
                  }}
                >
                  <X size={18} aria-hidden="true" />
                </button>
                <span className="absolute inset-x-0 bottom-0 bg-black/60 p-1.5 text-[10px] text-white">
                  {progress[item.id] || "Siap dikirim"}
                </span>
              </div>
            ))}
          </div>
        )}
      </fieldset>
      {action === "CREATE" && (
        <section className="mt-[22px]">
          <div className="flex items-center justify-between gap-2.5">
            <h3 className="m-0 text-[15px] font-semibold">Lokasi kejadian</h3>
            <button
              type="button"
              className={btnText}
              disabled={frozen}
              onClick={locate}
            >
              <LocateFixed size={16} aria-hidden="true" /> Ambil GPS
            </button>
          </div>
          <p className={`${mutedText} mb-2`} role="status">
            {gpsMessage}
          </p>
          <div className={frozen ? "pointer-events-none opacity-70" : ""}>
            <MapView
              editable={!frozen}
              point={point}
              onPoint={(value) => {
                if (lock.current) return;
                manual.current = true;
                setPoint(value);
                setSource("MANUAL");
              }}
            />
          </div>
          <p className={`${mutedText} mt-2`}>
            {point
              ? `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)} · ${
                  source === "GPS" ? "GPS" : "Pin manual"
                }`
              : "Ketuk peta atau geser pin untuk menentukan lokasi."}
          </p>
        </section>
      )}
      <p className="my-[22px] rounded-[7px] bg-[var(--rd-bg)] p-3 text-[10px] leading-[1.7] text-[var(--rd-muted)]">
        Teks draft tersimpan di perangkat ini, khusus akun Anda. Foto dan lokasi
        perlu dipilih ulang setelah halaman dimuat ulang.
      </p>
      {error && (
        <div className={alertBox} role="alert">
          {error}
          {attempt && (
            <p className="mt-2 mb-0">
              Data dikunci agar percobaan ulang tetap konsisten. Coba lagi
              dengan transaksi yang sama, atau tinggalkan percobaan untuk
              memeriksa laporan terbaru. Tidak ada pengiriman ulang otomatis.
            </p>
          )}
        </div>
      )}
      {attempt && !busy && confirmAbandon && (
        <section
          className={alertBox}
          aria-label="Konfirmasi tinggalkan percobaan"
        >
          <strong>Hasil pengiriman mungkin belum pasti</strong>
          <p className="mt-2 mb-0">
            Transaksi {attempt.id} mungkin sudah tersimpan meskipun respons
            gagal diterima. Meninggalkan halaman ini tidak membatalkan transaksi
            di server. Periksa daftar dan riwayat terbaru sebelum membuat
            pengiriman baru agar tidak terjadi duplikasi.
          </p>
          <p className="mt-2 mb-3">
            Draft teks tetap tersimpan. Foto dan lokasi harus dipilih ulang bila
            Anda membuka formulir baru.
          </p>
          <div className={formActions}>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setConfirmAbandon(false)}
            >
              Tetap di sini
            </button>
            <button type="button" className={btnDangerGhost} onClick={abandon}>
              Tinggalkan &amp; periksa laporan
            </button>
          </div>
        </section>
      )}
      {attempt && (
        <p role="status" className="mb-3 text-xs">
          {
            Object.values(progress).filter((value) => value === "Berhasil")
              .length
          }{" "}
          dari {files.length} foto berhasil ·{" "}
          {busy ? "Jangan tutup halaman." : "Pengiriman belum dikonfirmasi."}
        </p>
      )}
      <div className={formActions}>
        {!frozen && (
          <button
            type="button"
            className={btnSecondary}
            onClick={() => onCancel()}
          >
            Batal
          </button>
        )}
        {attempt && !busy && !confirmAbandon && (
          <button
            type="button"
            className={btnSecondary}
            onClick={() => setConfirmAbandon(true)}
          >
            Tinggalkan percobaan
          </button>
        )}
        <button
          disabled={busy || confirmAbandon}
          className={action === "DELETE" ? btnDanger : btnPrimary}
          type="submit"
        >
          {busy
            ? "Mengirim…"
            : attempt
              ? "Coba kirim kembali"
              : action === "CREATE"
                ? "Kirim laporan →"
                : action === "DELETE"
                  ? "Konfirmasi penutupan"
                  : "Simpan perubahan"}
        </button>
      </div>
    </form>
  );
}
