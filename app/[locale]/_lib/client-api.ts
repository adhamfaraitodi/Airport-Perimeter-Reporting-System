import { dispatchReportNotificationAction } from "./notifications.actions";
import { getProfileAction } from "../(internal)/profile/_lib/profile.actions";
import {
  getReportsAction,
  commitReportSubmissionAction,
  type UploadedFilePayload,
} from "../(internal)/operator/_lib/operator-reports.actions";
import { authClient } from "@/lib/auth-client";
import damageCatalog from "../_data/damage-catalog.json";

export type UserRole = "REPORTER" | "OPERATOR" | "TECHNICIAN";
export type LifecycleStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  nip?: string;
  phone?: string;
  unit?: string;
  image?: string;
  signatureUrl?: string;
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
  actorId?: string;
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
  segmentCode?: string;
  findings?: FindingItem[];
  narrative: string;
  latitude?: number;
  longitude?: number;
  gps?: GpsPoint | null;
  locationSource?: "GPS" | "MANUAL";
  expectedImageIds: string[];
}

export const isMock = false;

let role: UserRole = "OPERATOR";

const users: Record<UserRole, SessionUser> = {
  REPORTER: {
    id: "usr-admin-reporter",
    name: "Operator Admin",
    email: "1234567@perimeter.yia.id",
    nip: "1234567",
    role: "REPORTER",
  },
  OPERATOR: {
    id: "usr-admin-operator",
    name: "Operator Admin",
    email: "1234567@perimeter.yia.id",
    nip: "1234567",
    role: "OPERATOR",
  },
  TECHNICIAN: {
    id: "usr-admin-technician",
    name: "Operator Admin",
    email: "1234567@perimeter.yia.id",
    nip: "1234567",
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

export async function setMockRole(_next: UserRole): Promise<void> {
  // No-op: Authentication is strictly enforced via PostgreSQL & Better-Auth
}

export const api = {
  getSession: async (): Promise<SessionUser | null> => {
    try {
      const res = await authClient.getSession();
      const sessionUser = res?.data?.user as Record<string, unknown> | undefined;
      if (sessionUser && typeof sessionUser.id === "string") {
        const rawRole = sessionUser.role as string | undefined;
        const resolvedRole: UserRole =
          rawRole === "OPERATOR" || rawRole === "TECHNICIAN"
            ? rawRole
            : "REPORTER";
        role = resolvedRole;
        const activeUser: SessionUser = {
          id: sessionUser.id,
          name: (sessionUser.name as string) || "-",
          email: (sessionUser.email as string) || "-",
          role: resolvedRole,
          nip: (sessionUser.nip as string) || undefined,
          phone: (sessionUser.phone as string) || undefined,
          unit: (sessionUser.unit as string) || undefined,
          image: (sessionUser.image as string) || undefined,
          signatureUrl: (sessionUser.signatureUrl as string) || undefined,
        };
        if (!activeUser.image) {
          try {
            const p = await getProfileAction();
            if (p.success && p.user?.image) {
              activeUser.image = p.user.image;
            }
          } catch {
            /* ignore */
          }
        }
        users[resolvedRole] = activeUser;
        return clone(activeUser);
      }
    } catch {
      /* Better-Auth session lookup failed */
    }
    return null;
  },

  listReports: async (): Promise<ReportRecord[]> => {
    try {
      const res = await getReportsAction();
      if (res.success && res.reports) {
        reports.clear();
        for (const r of res.reports) {
          reports.set(r.id, r);
        }
        return res.reports;
      }
    } catch {
      /* Fallback to memory cache */
    }
    return clone(
      [...reports.values()].filter(
        (r) => role !== "REPORTER" || r.reporterId === users[role].id
      )
    );
  },

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
              fail("Jenis kerusakan tidak valid.\n");
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
    if (!submission || submission.committed) fail("Sesi unggah tidak valid.");
    if (!submission.payload.expectedImageIds.includes(imageId)) {
      fail("ID foto tidak terdaftar.");
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      fail("Format foto tidak didukung.");
    }
    images.set(imageId, `data:${mimeType};base64,${base64}`);
    return { id: imageId };
  },

  commitSubmission: async ({
    submissionId,
  }: {
    submissionId: string;
  }): Promise<ReportRecord> => {
    const submission = submissions.get(submissionId);
    if (!submission || submission.committed) fail("Sesi tidak dapat disimpan.");
    const p = submission.payload;

    // Collect uploaded base64 files
    const files: UploadedFilePayload[] = [];
    for (const imgId of p.expectedImageIds) {
      const base64 = images.get(imgId);
      if (base64) {
        const mimeType = base64.startsWith("data:image/png")
          ? "image/png"
          : base64.startsWith("data:image/webp")
          ? "image/webp"
          : "image/jpeg";
        files.push({
          id: imgId,
          mimeType,
          base64,
        });
      }
    }

    try {
      const res = await commitReportSubmissionAction({
        payload: p,
        files,
      });

      if (res.success && res.report) {
        submission.committed = true;
        reports.set(res.report.id, res.report);
        return clone(res.report);
      } else if (res.errorMessage) {
        fail(res.errorMessage);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message) fail(e.message);
      fail("Gagal menyimpan laporan ke database server.");
    }

    fail("Gagal menyelesaikan penyimpanan.");
  },

  finalizeSubmission: async (params: {
    submissionId: string;
  }): Promise<ReportRecord> => api.commitSubmission(params),

  getImage: async ({
    imageId,
  }: {
    imageId: string;
  }): Promise<{ url: string }> => {
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
