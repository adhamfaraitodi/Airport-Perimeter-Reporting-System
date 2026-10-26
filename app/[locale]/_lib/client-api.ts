import damageCatalog from "../_data/damage-catalog.json";

export type UserRole = "REPORTER" | "OPERATOR" | "TECHNICIAN";
export type LifecycleStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface DamageItem {
  id: string;
  name: string;
  exclusiveGroup?: string;
}

export interface FindingItem {
  partId: string;
  partName: string;
  damages: Array<{ id: string; name: string }>;
}

export interface ImageRef {
  id: string;
  url?: string;
}

export interface ReportHistoryItem {
  id: string;
  status: LifecycleStatus | "DELETE" | "CLOSED";
  previousStatus?: LifecycleStatus;
  narrative: string;
  createdAt: string;
  actorName: string;
  images: ImageRef[];
}

export interface GpsPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface ReportRecord {
  id: string;
  reporterId: string;
  reporterName: string;
  createdAt: string;
  side: string;
  segmentCode?: string;
  findings: FindingItem[];
  narrative: string;
  latitude: number;
  longitude: number;
  gps: GpsPoint | null;
  locationSource: "GPS" | "MANUAL";
  status: LifecycleStatus;
  deletedAt: string | null;
  deletionReason: string;
  images: ImageRef[];
  history: ReportHistoryItem[];
}

export interface BeginSubmissionPayload {
  id: string;
  action: "CREATE" | "STATUS" | "DELETE";
  reportId?: string;
  expectedStatus?: LifecycleStatus;
  status?: LifecycleStatus;
  side?: string;
  findings?: FindingItem[];
  narrative: string;
  latitude?: number;
  longitude?: number;
  gps?: GpsPoint | null;
  locationSource?: "GPS" | "MANUAL";
  expectedImageIds: string[];
}

export const isMock = true;

let role: UserRole = "REPORTER";

const users: Record<UserRole, SessionUser> = {
  REPORTER: {
    id: "demo-reporter",
    name: "Petugas Demo",
    email: "reporter@example.invalid",
    role: "REPORTER",
  },
  OPERATOR: {
    id: "demo-operator",
    name: "Operator Demo",
    email: "operator@example.invalid",
    role: "OPERATOR",
  },
  TECHNICIAN: {
    id: "demo-technician",
    name: "Teknisi Demo",
    email: "technician@example.invalid",
    role: "TECHNICIAN",
  },
};

const reports = new Map<string, ReportRecord>();
const submissions = new Map<
  string,
  {
    payload: BeginSubmissionPayload;
    actor: SessionUser;
    revision?: number;
    committed: boolean;
  }
>();
const images = new Map<string, string>();

const clone = <T>(value: T): T => structuredClone(value);

function fail(text: string): never {
  throw new Error(text);
}

const transitions: Record<LifecycleStatus, LifecycleStatus[]> = {
  OPEN: ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["OPEN"],
};

export async function setMockRole(next: UserRole): Promise<void> {
  if (!isMock || !users[next]) {
    fail("Pergantian role hanya tersedia dalam demo lokal.");
  }
  role = next;
}

export const api = {
  getSession: async (): Promise<SessionUser> => clone(users[role]),

  listReports: async (): Promise<ReportRecord[]> =>
    clone(
      [...reports.values()].filter(
        (r) => role !== "REPORTER" || r.reporterId === users[role].id
      )
    ),

  beginSubmission: async (
    payload: BeginSubmissionPayload
  ): Promise<{ id: string }> => {
    const existing = submissions.get(payload.id);
    if (existing) {
      if (
        existing.actor.id !== users[role].id ||
        JSON.stringify(existing.payload) !== JSON.stringify(payload)
      ) {
        fail("Transaksi tidak cocok.");
      }
      return { id: payload.id };
    }
    if (
      !payload.narrative?.trim() ||
      Array.from(payload.narrative).length > 2000 ||
      !payload.expectedImageIds?.length
    ) {
      fail("Narasi dan foto wajib diisi.");
    }
    if (payload.action === "CREATE") {
      if (role !== "REPORTER") fail("Hanya reporter dapat membuat laporan.");
      if (
        !Number.isFinite(payload.latitude) ||
        !Number.isFinite(payload.longitude)
      ) {
        fail("Lokasi belum lengkap.");
      }
      if (!payload.side && !payload.findings?.length) {
        fail("Bagian pagar belum dipilih.");
      }
      if (payload.findings) {
        const partIds = new Set<string>();
        for (const finding of payload.findings) {
          const part = damageCatalog.find((item) => item.id === finding.partId);
          if (!part || partIds.has(part.id) || !finding.damages?.length) {
            fail("Pilihan bagian/kerusakan tidak valid.");
          }
          partIds.add(part.id);
          const groups = new Set<string>();
          const damageIds = new Set<string>();
          for (const selected of finding.damages) {
            const damage = (part.damages as DamageItem[]).find(
              (item) => item.id === selected.id
            );
            if (!damage || damageIds.has(damage.id)) {
              fail("Jenis kerusakan tidak valid.");
            }
            damageIds.add(damage.id);
            if (damage.exclusiveGroup && groups.has(damage.exclusiveGroup)) {
              fail("Pilih satu tingkat korosi per bagian.");
            }
            if (damage.exclusiveGroup) groups.add(damage.exclusiveGroup);
          }
        }
      }
    } else {
      const report = payload.reportId ? reports.get(payload.reportId) : undefined;
      if (role === "REPORTER" || !report || report.deletedAt) {
        fail("Tidak dapat memperbarui laporan.");
      }
      if (report.status !== payload.expectedStatus) {
        fail("Status telah berubah.");
      }
      if (
        payload.action === "STATUS" &&
        (!payload.status || !transitions[report.status].includes(payload.status))
      ) {
        fail("Transisi status tidak valid.");
      }
      if (!["STATUS", "DELETE"].includes(payload.action)) {
        fail("Tindakan tidak valid.");
      }
    }
    submissions.set(payload.id, {
      payload: clone(payload),
      actor: clone(users[role]),
      revision: payload.reportId
        ? reports.get(payload.reportId)?.history.length
        : undefined,
      committed: false,
    });
    return { id: payload.id };
  },

  uploadImage: async ({
    submissionId,
    imageId,
    mimeType,
    base64,
  }: {
    submissionId: string;
    imageId: string;
    name?: string;
    mimeType: string;
    base64: string;
  }): Promise<{ id: string }> => {
    const submission = submissions.get(submissionId);
    if (
      !submission ||
      submission.actor.id !== users[role].id ||
      !submission.payload.expectedImageIds.includes(imageId)
    ) {
      fail("Upload tidak diizinkan.");
    }
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(mimeType) ||
      !base64 ||
      atob(base64).length > 3000000
    ) {
      fail("Foto tidak valid atau melebihi 3 MB.");
    }
    const url = `data:${mimeType};base64,${base64}`;
    if (images.has(imageId) && images.get(imageId) !== url) {
      fail("ID foto telah digunakan.");
    }
    images.set(imageId, url);
    return { id: imageId };
  },

  finalizeSubmission: async ({
    submissionId,
  }: {
    submissionId: string;
  }): Promise<ReportRecord> => {
    const submission = submissions.get(submissionId);
    if (!submission || submission.actor.id !== users[role].id) {
      fail("Transaksi tidak ditemukan.");
    }
    const p = submission.payload;
    if (submission.committed) {
      const existingReport = reports.get(p.reportId || p.id);
      if (existingReport) return clone(existingReport);
    }
    if (p.expectedImageIds.some((id) => !images.has(id))) {
      fail("Foto belum lengkap.");
    }
    const evidence: ImageRef[] = p.expectedImageIds.map((id) => ({ id }));
    const now = new Date().toISOString();
    let report: ReportRecord;

    if (p.action === "CREATE") {
      report = {
        id: p.id,
        reporterId: submission.actor.id,
        reporterName: submission.actor.name || submission.actor.email,
        createdAt: now,
        side: p.side || "",
        findings: clone(p.findings || []),
        narrative: p.narrative,
        latitude: p.latitude!,
        longitude: p.longitude!,
        gps: p.gps || null,
        locationSource: p.locationSource || "MANUAL",
        status: "OPEN",
        deletedAt: null,
        deletionReason: "",
        images: evidence,
        history: [],
      };
    } else {
      const existing = p.reportId ? reports.get(p.reportId) : undefined;
      if (
        !existing ||
        existing.deletedAt ||
        existing.status !== p.expectedStatus ||
        existing.history.length !== submission.revision
      ) {
        fail("Laporan berubah. Muat ulang untuk memulai tindakan baru.");
      }
      report = existing;
      const previousStatus = report.status;
      if (p.action === "DELETE") {
        report.deletedAt = now;
        report.deletionReason = p.narrative;
      } else if (p.status) {
        report.status = p.status;
      }
      report.history.push({
        id: p.id,
        status: p.action === "DELETE" ? "CLOSED" : p.status || report.status,
        previousStatus,
        narrative: p.narrative,
        createdAt: now,
        actorName: submission.actor.name,
        images: evidence,
      });
    }
    reports.set(report.id, report);
    submission.committed = true;
    return clone(report);
  },

  getImage: async ({ imageId }: { imageId: string }): Promise<{ url: string }> => {
    const visible = [...reports.values()].some(
      (r) =>
        (role !== "REPORTER" || r.reporterId === users[role].id) &&
        [...r.images, ...r.history.flatMap((h) => h.images)].some(
          (i) => i.id === imageId
        )
    );
    const url = images.get(imageId);
    if (!visible || !url) fail("Foto tidak tersedia.");
    return { url };
  },
};
