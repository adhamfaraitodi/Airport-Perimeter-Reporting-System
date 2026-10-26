"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { Check, LocateFixed, Plus, Trash2, X } from "lucide-react";
import catalog from "../../../_data/damage-catalog.json";
import {
  api,
  isMock,
  type BeginSubmissionPayload,
  type DamageItem,
  type GpsPoint,
  type ReportRecord,
  type SessionUser,
} from "../../../_lib/client-api";
import { countText, message, newId, useDrafts } from "../../../_lib/draft-store";
import MapView, {
  isPointInNavigationBounds,
  type LatLngPoint,
} from "../../../_components/perimeter-map-view";

interface CatalogPart {
  id: string;
  name: string;
  damages: DamageItem[];
}

const parts: CatalogPart[] = (catalog as CatalogPart[]).map((part) => ({
  ...part,
  damages: [...part.damages].sort((a, b) => a.name.localeCompare(b.name, "id")),
}));

const button =
  "border-0 font-normal shadow-none hover:shadow-none hover:filter-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)] disabled:cursor-not-allowed disabled:opacity-50";
const secondary = `${button} rounded-lg border! border-solid! border-[var(--rd-border)]! bg-[var(--rd-surface)] px-3 py-1.5 text-[var(--rd-text)]`;
const muted = "text-xs text-[var(--rd-muted)]";

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reader.onabort = () =>
      reject(new Error("Foto tidak dapat dibaca. Coba kirim kembali."));
    reader.readAsDataURL(file);
  });
}

function Chip({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`${button} inline-flex min-h-8 items-center gap-1 rounded-lg px-2 py-1 text-xs ${
        selected
          ? "bg-[var(--rd-active)] text-[var(--rd-link)]"
          : "bg-[var(--rd-border)] text-[var(--rd-muted)]"
      }`}
    >
      {selected ? (
        <Check size={16} aria-hidden="true" />
      ) : (
        <Plus size={16} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

interface PendingFile {
  id: string;
  file: File;
  preview: string;
}

interface SubmissionAttempt {
  payload: BeginSubmissionPayload;
  files: PendingFile[];
  uploaded: Set<string>;
}

export interface CreateReportDialogProps {
  user: SessionUser;
  onSuccess?: (report: ReportRecord) => void;
  onCancel?: (options?: { abandonedSubmissionId?: string }) => void;
  onLock?: (locked: boolean) => void;
}

export function CreateReportDialog(props: CreateReportDialogProps) {
  return <ReporterFormSession key={props.user.id} {...props} />;
}

function ReporterFormSession({
  user,
  onSuccess,
  onCancel,
  onLock,
}: CreateReportDialogProps) {
  const key = `${user.id}:CREATE:reporter-findings`;
  const draft = useDrafts((state) => state.drafts[key]);
  const update = useDrafts((state) => state.update);
  const clear = useDrafts((state) => state.clear);
  const selection = draft?.selection || {};
  const narrative = draft?.narrative || "";
  const id = useId();

  const [files, setFiles] = useState<PendingFile[]>([]);
  const [point, setPoint] = useState<LatLngPoint | null>(null);
  const [gps, setGps] = useState<GpsPoint | null>(null);
  const [source, setSource] = useState<"GPS" | "MANUAL">("MANUAL");
  const [gpsMessage, setGpsMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState<SubmissionAttempt | null>(null);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<"attempt" | "evidence" | null>(
    null
  );

  const filesRef = useRef<PendingFile[]>([]);
  const attemptRef = useRef<SubmissionAttempt | null>(null);
  const inFlight = useRef(false);
  const completed = useRef(false);
  const mounted = useRef(false);
  const gpsRequest = useRef(0);
  const manualRevision = useRef(0);
  const lockCallback = useRef(onLock);
  lockCallback.current = onLock;

  const frozen = !!attempt || busy;
  const selectedParts = parts.filter((part) =>
    Array.isArray(selection[part.id])
  );
  const blocked = () =>
    inFlight.current || !!attemptRef.current || completed.current;

  useEffect(() => {
    mounted.current = true;
    const warn = (event: BeforeUnloadEvent) => {
      if (
        !completed.current &&
        (attemptRef.current || filesRef.current.length)
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    locate();
    return () => {
      mounted.current = false;
      gpsRequest.current += 1;
      filesRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
      window.removeEventListener("beforeunload", warn);
      lockCallback.current?.(false);
    };
  }, []);

  useEffect(() => {
    onLock?.(frozen);
  }, [frozen, onLock]);

  function locate() {
    if (blocked()) return;
    const request = ++gpsRequest.current;
    const revision = manualRevision.current;
    if (!navigator.geolocation) {
      setGpsMessage("GPS tidak tersedia. Ketuk peta untuk memilih lokasi.");
      return;
    }
    setGpsMessage("Mencari lokasi GPS…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!mounted.current || blocked() || request !== gpsRequest.current)
          return;
        const original: GpsPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setGps(original);
        if (
          revision === manualRevision.current &&
          manualRevision.current === 0
        ) {
          setPoint({
            latitude: original.latitude,
            longitude: original.longitude,
          });
          setSource("GPS");
        }
        setGpsMessage(
          `GPS asli tercatat · akurasi ±${Math.round(original.accuracy)} m. ${
            manualRevision.current ? "Pin manual tetap digunakan. " : ""
          }${
            isPointInNavigationBounds(original)
              ? ""
              : "GPS di luar jangkauan peta; koordinat asli tetap disimpan. Pilih pin manual bila perlu."
          }`
        );
      },
      () => {
        if (mounted.current && !blocked() && request === gpsRequest.current) {
          setGpsMessage(
            "GPS tidak dapat diakses. Ketuk peta untuk memilih lokasi manual."
          );
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function togglePart(part: CatalogPart) {
    if (blocked()) return;
    const next = { ...selection };
    if (Array.isArray(next[part.id])) delete next[part.id];
    else next[part.id] = [];
    update(key, { selection: next });
  }

  function toggleDamage(part: CatalogPart, damage: DamageItem) {
    if (blocked()) return;
    const current = selection[part.id] || [];
    const next = current.includes(damage.id)
      ? current.filter((value) => value !== damage.id)
      : [
          ...current.filter(
            (value) =>
              !damage.exclusiveGroup ||
              part.damages.find((item) => item.id === value)?.exclusiveGroup !==
                damage.exclusiveGroup
          ),
          damage.id,
        ];
    update(key, { selection: { ...selection, [part.id]: next } });
  }

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    if (blocked()) return;
    const accepted: PendingFile[] = [];
    const errors: string[] = [];
    for (const file of Array.from(event.target.files || [])) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        errors.push(`${file.name}: gunakan JPEG, PNG, atau WebP.`);
      } else if (!file.size || file.size > 3000000) {
        errors.push(
          `${file.name}: foto harus berisi data dan maksimal 3.000.000 byte.`
        );
      } else {
        accepted.push({
          id: newId(),
          file,
          preview: URL.createObjectURL(file),
        });
      }
    }
    filesRef.current = [...filesRef.current, ...accepted];
    setFiles(filesRef.current);
    setError(errors.join(" "));
    event.target.value = "";
  }

  function removeFile(item: PendingFile) {
    if (blocked()) return;
    filesRef.current = filesRef.current.filter((file) => file.id !== item.id);
    setFiles(filesRef.current);
    URL.revokeObjectURL(item.preview);
  }

  function requestCancel() {
    if (inFlight.current || completed.current) return;
    if (attemptRef.current) setConfirmation("attempt");
    else if (filesRef.current.length || point || gps)
      setConfirmation("evidence");
    else onCancel?.();
  }

  function leave() {
    if (inFlight.current || !confirmation) return;
    const abandonedSubmissionId = attemptRef.current?.payload.id;
    completed.current = true;
    gpsRequest.current += 1;
    lockCallback.current?.(false);
    onCancel?.(abandonedSubmissionId ? { abandonedSubmissionId } : undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || completed.current || confirmation) return;
    if (!isMock) {
      setError("Integrasi field baru belum tersedia");
      return;
    }
    inFlight.current = true;
    setError("");
    let result: ReportRecord | undefined;
    try {
      if (!attemptRef.current) {
        const findings = selectedParts.map((part) => ({
          partId: part.id,
          partName: part.name,
          damages: part.damages
            .filter((damage) => selection[part.id].includes(damage.id))
            .map(({ id: dId, name }) => ({ id: dId, name })),
        }));
        const invalidGroups = selectedParts.some((part) => {
          const groups = part.damages
            .filter(
              (damage) =>
                selection[part.id].includes(damage.id) && damage.exclusiveGroup
            )
            .map((damage) => damage.exclusiveGroup);
          return new Set(groups).size !== groups.length;
        });
        if (
          !findings.length ||
          findings.some((finding) => !finding.damages.length) ||
          invalidGroups ||
          !narrative.trim() ||
          countText(narrative) > 2000 ||
          !filesRef.current.length ||
          !point ||
          !Number.isFinite(point.latitude) ||
          !Number.isFinite(point.longitude)
        ) {
          setError(
            "Pilih bagian dan minimal satu kerusakan per bagian (satu tingkat karat saja), isi narasi maksimal 2.000 karakter, minimal satu foto, dan lokasi kejadian."
          );
          return;
        }
        attemptRef.current = {
          payload: {
            id: newId(),
            action: "CREATE",
            findings,
            narrative: narrative.trim(),
            latitude: point.latitude,
            longitude: point.longitude,
            gps: gps ? { ...gps } : null,
            locationSource: source,
            expectedImageIds: filesRef.current.map((item) => item.id),
          },
          files: [...filesRef.current],
          uploaded: new Set(),
        };
      }
      const transaction = attemptRef.current;
      setAttempt(transaction);
      setBusy(true);
      lockCallback.current?.(true);
      const submission = await api.beginSubmission(transaction.payload);
      for (const item of transaction.files) {
        if (transaction.uploaded.has(item.id)) continue;
        if (mounted.current)
          setProgress((old) => ({ ...old, [item.id]: "Mengunggah" }));
        try {
          await api.uploadImage({
            submissionId: submission.id,
            imageId: item.id,
            name: item.file.name,
            mimeType: item.file.type,
            base64: await readBase64(item.file),
          });
          transaction.uploaded.add(item.id);
          if (mounted.current)
            setProgress((old) => ({ ...old, [item.id]: "Berhasil" }));
        } catch (uploadError) {
          if (mounted.current)
            setProgress((old) => ({ ...old, [item.id]: "Gagal" }));
          throw uploadError;
        }
      }
      result = await api.finalizeSubmission({ submissionId: submission.id });
      completed.current = true;
      clear(key);
    } catch (submitError) {
      if (mounted.current) setError(message(submitError));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
    if (completed.current && mounted.current && result) {
      lockCallback.current?.(false);
      onSuccess?.(result);
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-labelledby={`${id}-title`}
      className="rounded-xl border border-[var(--rd-border)] bg-[var(--rd-surface)] p-3.5 text-[var(--rd-text)] sm:p-6"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2
          id={`${id}-title`}
          className="m-0 text-base font-normal tracking-normal"
        >
          Buat Laporan Baru
        </h2>
        <button
          type="button"
          aria-label="Tutup formulir"
          disabled={busy}
          onClick={requestCancel}
          className={`${button} flex min-h-9 items-center justify-center bg-transparent p-1 text-[var(--rd-link)]`}
        >
          <X size={22} aria-hidden="true" />
        </button>
      </div>
      <p className={`${muted} mb-7 max-w-sm`}>
        Informasi yang jelas membantu tim menindaklanjuti kondisi perimeter.
      </p>
      <fieldset
        disabled={frozen || !!confirmation}
        className="m-0 min-w-0 space-y-6 border-0 p-0"
      >
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="mb-3 text-sm">Bagian Pagar Perimeter</legend>
          <p className={`${muted} mb-3`}>Pilih satu atau lebih bagian pagar</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {parts.map((part) => (
              <Chip
                key={part.id}
                selected={Array.isArray(selection[part.id])}
                onClick={() => togglePart(part)}
              >
                {part.name}
              </Chip>
            ))}
          </div>
        </fieldset>
        <section aria-labelledby={`${id}-damages`}>
          <h3 id={`${id}-damages`} className="mb-3 text-sm font-normal">
            Jenis Kerusakan
          </h3>
          <p className={`${muted} mb-3`}>
            Pilih satu atau lebih kerusakan untuk setiap bagian.
          </p>
          {!selectedParts.length && (
            <p className={muted}>Pilih bagian pagar terlebih dahulu.</p>
          )}
          <div className="space-y-3">
            {selectedParts.map((part) => (
              <fieldset
                key={part.id}
                className="m-0 min-w-0 rounded-lg border border-[var(--rd-border)] px-2 pb-3 pt-1"
              >
                <legend className="px-1 text-xs">{part.name}</legend>
                <div className="flex flex-wrap gap-2">
                  {part.damages.map((damage) => (
                    <Chip
                      key={damage.id}
                      selected={selection[part.id].includes(damage.id)}
                      onClick={() => toggleDamage(part, damage)}
                    >
                      {damage.name}
                    </Chip>
                  ))}
                </div>
                {part.damages.some((damage) => damage.exclusiveGroup) && (
                  <p className={`${muted} mb-0 mt-2`}>
                    Berkarat sedang dan berat tidak dapat dipilih bersamaan.
                    Memilih salah satu menggantikan tingkat karat sebelumnya
                    pada bagian ini.
                  </p>
                )}
              </fieldset>
            ))}
          </div>
        </section>
        <div>
          <label
            htmlFor={`${id}-narrative`}
            className="mb-3 text-sm font-normal"
          >
            Narasi Laporan Temuan
          </label>
          <textarea
            id={`${id}-narrative`}
            rows={4}
            value={narrative}
            aria-describedby={`${id}-count`}
            placeholder="Jelaskan dengan detail mengenai temuan"
            onChange={(event) => {
              if (!blocked())
                update(key, {
                  narrative: Array.from(event.target.value)
                    .slice(0, 2000)
                    .join(""),
                });
            }}
            className="m-0 w-full rounded-lg border border-[var(--rd-border)] bg-[var(--rd-surface)] p-3 text-sm text-[var(--rd-text)] placeholder:text-[var(--rd-muted)] focus-visible:outline-[var(--rd-link)]"
          />
          <p id={`${id}-count`} className={`${muted} mb-0 mt-2 text-right`}>
            {countText(narrative).toLocaleString("id-ID")} / 2.000 karakter
          </p>
        </div>
        <section aria-labelledby={`${id}-photos`}>
          <h3 id={`${id}-photos`} className="mb-3 text-sm font-normal">
            Foto-foto Laporan Temuan
          </h3>
          <label className="relative mb-0 flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-[var(--rd-border)] p-4 text-center text-sm font-normal focus-within:outline-2 focus-within:outline-[var(--rd-link)]">
            <Plus
              size={22}
              className="text-[var(--rd-muted)]"
              aria-hidden="true"
            />
            <span>Tambahkan foto dokumentasi</span>
            <span className={muted}>
              JPEG, PNG, WebP · maksimal 3 MB (3.000.000 byte) per foto ·
              minimal 1 foto
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
            <ul className="mt-3 flex list-none flex-wrap gap-3 p-0">
              {files.map((item) => (
                <li
                  key={item.id}
                  className="relative w-32 overflow-hidden rounded-lg border border-[var(--rd-border)] bg-[var(--rd-bg)]"
                >
                  <img
                    src={item.preview}
                    alt={item.file.name}
                    className="h-24 w-full object-cover"
                  />
                  <button
                    type="button"
                    aria-label={`Hapus foto ${item.file.name}`}
                    onClick={() => removeFile(item)}
                    className={`${button} absolute right-1 top-1 flex min-h-8 items-center rounded-md bg-[var(--rd-surface)] p-2 text-[var(--rd-coral)]`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                  <span
                    className="block truncate px-2 pt-1 text-xs"
                    title={item.file.name}
                  >
                    {item.file.name}
                  </span>
                  <span className={`${muted} block px-2 pb-2`} role="status">
                    {progress[item.id] || "Menunggu"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </fieldset>
      <section className="mt-6" aria-labelledby={`${id}-location`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 id={`${id}-location`} className="m-0 text-sm font-normal">
            Lokasi kejadian
          </h3>
          <button
            type="button"
            disabled={frozen || !!confirmation}
            onClick={locate}
            className={`${button} inline-flex min-h-9 items-center gap-1 bg-transparent px-1 py-1 text-xs text-[var(--rd-link)]`}
          >
            <LocateFixed size={20} aria-hidden="true" /> GPS
          </button>
        </div>
        <p className={`${muted} mb-2`} role="status">
          {gpsMessage}
        </p>
        <MapView
          editable={!frozen && !confirmation}
          point={point}
          onPoint={(value) => {
            if (blocked() || confirmation) return;
            manualRevision.current += 1;
            setPoint(value);
            setSource("MANUAL");
          }}
          className="border-[var(--rd-border)]! bg-[var(--rd-bg)]! [&_.overview]:bg-[var(--rd-surface)] [&_.overview]:text-[var(--rd-link)] [&_.map-note]:bg-[var(--rd-surface)] [&_.map-note]:text-[var(--rd-muted)] [&_.map-warning]:bg-[var(--rd-surface)] [&_.map-warning]:text-[var(--rd-coral)]"
        />
        <p className={`${muted} mb-0 mt-2`}>
          {point
            ? `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)} · ${
                source === "GPS" ? "GPS" : "Pin manual"
              }`
            : "Ketuk peta atau geser pin untuk menentukan lokasi."}
        </p>
        {gps && (
          <p className={`${muted} mb-0 mt-1`}>
            GPS asli: {gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)} ·
            akurasi ±{Math.round(gps.accuracy)} m
          </p>
        )}
      </section>
      <p className={`${muted} my-5 rounded-lg bg-[var(--rd-bg)] p-3`}>
        Pilihan bagian, kerusakan, dan teks draft tersimpan di perangkat ini
        khusus akun Anda. Foto dan koordinat hanya disimpan dalam memori; pilih
        ulang setelah menutup formulir atau memuat ulang halaman.
      </p>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-[var(--rd-coral)] p-3 text-sm text-[var(--rd-coral)]"
        >
          {error}
          {attempt && (
            <p className="mb-0 mt-2">
              Data dikunci. Coba kembali dengan transaksi yang sama; foto yang
              berhasil tidak diunggah ulang. Tidak ada pengiriman ulang
              otomatis.
            </p>
          )}
        </div>
      )}
      {attempt && (
        <p role="status" className={muted}>
          {
            Object.values(progress).filter((value) => value === "Berhasil")
              .length
          }{" "}
          dari {files.length} foto berhasil ·{" "}
          {busy
            ? "Mengirim, jangan tutup halaman."
            : "Pengiriman belum dikonfirmasi."}
        </p>
      )}
      {confirmation && (
        <section
          aria-labelledby={`${id}-confirm`}
          className="mb-4 rounded-lg border border-[var(--rd-coral)] p-3 text-sm"
        >
          <h3 id={`${id}-confirm`} className="text-sm text-[var(--rd-coral)]">
            {confirmation === "attempt"
              ? "Hasil pengiriman mungkin belum pasti"
              : "Tinggalkan foto dan lokasi yang belum dikirim?"}
          </h3>
          {confirmation === "attempt" && (
            <p className="break-words">
              Transaksi {attempt?.payload.id} mungkin sudah tersimpan meskipun
              respons gagal diterima. Meninggalkan formulir tidak membatalkan
              transaksi. Periksa daftar dan riwayat laporan terbaru sebelum
              membuat pengiriman baru agar tidak terjadi duplikasi.
            </p>
          )}
          <p>
            Pilihan dan teks draft tetap tersimpan. Foto dan lokasi perlu
            dipilih ulang saat membuka formulir lagi.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={secondary}
              onClick={() => setConfirmation(null)}
            >
              Tetap di sini
            </button>
            <button
              type="button"
              className={`${secondary} text-[var(--rd-coral)]!`}
              onClick={leave}
            >
              {confirmation === "attempt"
                ? "Tinggalkan & periksa laporan"
                : "Tinggalkan formulir"}
            </button>
          </div>
        </section>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={busy || !!confirmation}
          onClick={requestCancel}
          className={secondary}
        >
          {attempt ? "Tinggalkan percobaan" : "Batal"}
        </button>
        <button
          type="submit"
          disabled={busy || !!confirmation}
          className={`${button} rounded-lg bg-[var(--rd-primary)] px-3 py-1.5 text-sm font-semibold text-white`}
        >
          {busy
            ? "Mengirim…"
            : attempt
              ? "Coba kirim kembali"
              : "Kirim Laporan"}
        </button>
      </div>
    </form>
  );
}
