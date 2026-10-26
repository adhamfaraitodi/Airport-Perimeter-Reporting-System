"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
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

  return (
    <form className="submission" onSubmit={submit}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            {action === "CREATE" ? "PELAPORAN LAPANGAN" : "TINDAKAN OPERATOR"}
          </span>
          <h2>
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
            className="icon-button"
            aria-label="Tutup formulir"
            onClick={() => onCancel()}
          >
            ×
          </button>
        )}
      </div>
      <p className="muted">
        {action === "DELETE"
          ? "Penutupan menyembunyikan titik dari peta, bukan menghapus bukti atau menyatakan masalah selesai."
          : "Informasi yang jelas membantu tim menindaklanjuti kondisi perimeter."}
      </p>
      <fieldset disabled={frozen}>
        {action === "STATUS" && report && (
          <label>
            Status berikutnya
            <select
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
          <label>
            Sisi perimeter
            <select
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
        <label>
          {action === "DELETE"
            ? "Alasan penutupan"
            : "Narasi laporan / tindakan"}
          <textarea
            rows={5}
            value={narrative}
            onChange={(e) => update(key, { narrative: e.target.value })}
            placeholder="Jelaskan kondisi, titik patokan, dan tindakan yang diperlukan."
            aria-describedby="narrative-count"
          />
        </label>
        <div
          id="narrative-count"
          className={`counter ${countText(narrative) > 2000 ? "invalid" : ""}`}
        >
          {countText(narrative).toLocaleString("id-ID")} / 2.000 karakter
        </div>
        <label className="upload-box">
          <span className="upload-symbol">+</span>
          <strong>Tambahkan foto bukti</strong>
          <span>JPG, PNG, WebP · maksimal 3 MB per foto</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={selectFiles}
          />
        </label>
        {!!files.length && (
          <div className="previews">
            {files.map((item) => (
              <div className="preview" key={item.id}>
                <img src={item.preview} alt={item.file.name} />
                <button
                  type="button"
                  aria-label={`Hapus ${item.file.name}`}
                  onClick={() => {
                    URL.revokeObjectURL(item.preview);
                    setFiles((old) =>
                      old.filter((file) => file.id !== item.id)
                    );
                  }}
                >
                  ×
                </button>
                <span>{progress[item.id] || "Siap dikirim"}</span>
              </div>
            ))}
          </div>
        )}
      </fieldset>
      {action === "CREATE" && (
        <section className="location-section">
          <div className="section-heading">
            <h3>Lokasi kejadian</h3>
            <button
              type="button"
              className="text-button"
              disabled={frozen}
              onClick={locate}
            >
              ⌖ Ambil GPS
            </button>
          </div>
          <p className="muted small" role="status">
            {gpsMessage}
          </p>
          <div className={frozen ? "map-disabled" : ""}>
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
          <p className="small muted">
            {point
              ? `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)} · ${
                  source === "GPS" ? "GPS" : "Pin manual"
                }`
              : "Ketuk peta atau geser pin untuk menentukan lokasi."}
          </p>
        </section>
      )}
      <p className="draft-note">
        Teks draft tersimpan di perangkat ini, khusus akun Anda. Foto dan lokasi
        perlu dipilih ulang setelah halaman dimuat ulang.
      </p>
      {error && (
        <div className="alert" role="alert">
          {error}
          {attempt && (
            <p>
              Data dikunci agar percobaan ulang tetap konsisten. Coba lagi
              dengan transaksi yang sama, atau tinggalkan percobaan untuk
              memeriksa laporan terbaru. Tidak ada pengiriman ulang otomatis.
            </p>
          )}
        </div>
      )}
      {attempt && !busy && confirmAbandon && (
        <section className="alert" aria-label="Konfirmasi tinggalkan percobaan">
          <strong>Hasil pengiriman mungkin belum pasti</strong>
          <p>
            Transaksi {attempt.id} mungkin sudah tersimpan meskipun respons
            gagal diterima. Meninggalkan halaman ini tidak membatalkan transaksi
            di server. Periksa daftar dan riwayat terbaru sebelum membuat
            pengiriman baru agar tidak terjadi duplikasi.
          </p>
          <p>
            Draft teks tetap tersimpan. Foto dan lokasi harus dipilih ulang bila
            Anda membuka formulir baru.
          </p>
          <div className="form-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setConfirmAbandon(false)}
            >
              Tetap di sini
            </button>
            <button type="button" className="danger-ghost" onClick={abandon}>
              Tinggalkan & periksa laporan
            </button>
          </div>
        </section>
      )}
      {attempt && (
        <p role="status" className="small">
          {
            Object.values(progress).filter((value) => value === "Berhasil")
              .length
          }{" "}
          dari {files.length} foto berhasil ·{" "}
          {busy ? "Jangan tutup halaman." : "Pengiriman belum dikonfirmasi."}
        </p>
      )}
      <div className="form-actions">
        {!frozen && (
          <button
            type="button"
            className="secondary"
            onClick={() => onCancel()}
          >
            Batal
          </button>
        )}
        {attempt && !busy && !confirmAbandon && (
          <button
            type="button"
            className="secondary"
            onClick={() => setConfirmAbandon(true)}
          >
            Tinggalkan percobaan
          </button>
        )}
        <button
          disabled={busy || confirmAbandon}
          className={action === "DELETE" ? "danger" : ""}
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
