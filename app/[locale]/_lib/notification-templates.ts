/**
 * Reusable i18n Notification Template Registry
 * Compatible with [locale] routing ("id" and "en").
 * The database only stores { templateKey, params }, keeping row sizes ultra-lightweight.
 */

export type NotificationTemplateKey =
  | "REPORT_NEW_OPERATOR"
  | "REPORT_NEW_TECHNICIAN"
  | "STATUS_UPDATE_REPORTER"
  | "STATUS_UPDATE_OPERATOR"
  | "STATUS_UPDATE_TECHNICIAN"
  | "REPORT_CLOSED_REPORTER"
  | "REPORT_CLOSED_TECHNICIAN"
  | "SYSTEM_ALERT";

export interface NotificationParams {
  part?: string;
  side?: string;
  grid?: string;
  status?: string;
  previousStatus?: string;
  actorName?: string;
  note?: string;
  title?: string;
  message?: string;
  [key: string]: unknown;
}

interface TemplateDefinition {
  title: (p: NotificationParams) => string;
  description: (p: NotificationParams) => string;
}

const statusLabels: Record<string, { id: string; en: string }> = {
  OPEN: { id: "Laporan", en: "New" },
  IN_PROGRESS: { id: "Sedang Ditangani", en: "In Progress" },
  RESOLVED: { id: "Selesai Ditangani", en: "Resolved" },
  CLOSED: { id: "Ditutup", en: "Closed" },
};

export const NOTIFICATION_TEMPLATES: Record<
  "id" | "en",
  Record<NotificationTemplateKey, TemplateDefinition>
> = {
  id: {
    REPORT_NEW_OPERATOR: {
      title: (p) => `Laporan Baru · ${p.part || "Perimeter"}`,
      description: (p) =>
        `Ditemukan kerusakan di Sisi ${p.side || "-"}${
          p.grid ? ` (Grid ${p.grid})` : ""
        }. Menunggu disposisi.`,
    },
    REPORT_NEW_TECHNICIAN: {
      title: (p) => `Tugas Perbaikan Baru · ${p.part || "Perimeter"}`,
      description: (p) =>
        `Perlu penanganan teknis di Sisi ${p.side || "-"}${
          p.grid ? ` (Grid ${p.grid})` : ""
        }.`,
    },
    STATUS_UPDATE_REPORTER: {
      title: (p) => {
        if (p.status === "OPEN" && p.previousStatus === "IN_PROGRESS") {
          return "Perbaikan Sedang Ditinjau Ulang";
        }
        if (p.status === "RESOLVED") {
          return "Laporan Anda Selesai & Diverifikasi";
        }
        return "Laporan Anda Ditangani";
      },
      description: (p) => {
        const actor = p.actorName ? ` oleh ${p.actorName}` : "";
        if (p.status === "OPEN" && p.previousStatus === "IN_PROGRESS") {
          const noteSuffix = p.note ? ` Catatan: ${p.note}` : "";
          return `Perbaikan ${p.part || "perimeter"} di Sisi ${
            p.side || "-"
          }${p.grid ? ` (Grid ${p.grid})` : ""} dikembalikan ke teknisi${actor} untuk perbaikan ulang.${noteSuffix}`;
        }
        if (p.status === "RESOLVED") {
          return `Perbaikan kerusakan ${p.part || "perimeter"} di Sisi ${
            p.side || "-"
          }${p.grid ? ` (Grid ${p.grid})` : ""} telah diverifikasi selesai${actor}.`;
        }
        return `Perbaikan kerusakan ${p.part || "perimeter"} di Sisi ${
          p.side || "-"
        }${p.grid ? ` (Grid ${p.grid})` : ""} telah selesai ditangani${actor} dan menunggu verifikasi operator.`;
      },
    },
    STATUS_UPDATE_OPERATOR: {
      title: (p) => {
        const part = p.part || "Perimeter";
        if (p.status === "OPEN" && p.previousStatus === "IN_PROGRESS") {
          return `Laporan Dikembalikan · ${part}`;
        }
        if (p.status === "RESOLVED") {
          return `Perbaikan Diverifikasi · ${part}`;
        }
        if (p.status === "IN_PROGRESS") {
          return `Menunggu Verifikasi · ${part}`;
        }
        const s = statusLabels[p.status || ""]?.id || p.status || "Status";
        return `Status Diperbarui · ${s}`;
      },
      description: (p) => {
        const actor = p.actorName ? ` oleh ${p.actorName}` : "";
        const location = `Sisi ${p.side || "-"}${p.grid ? ` (Grid ${p.grid})` : ""}`;
        if (p.status === "OPEN" && p.previousStatus === "IN_PROGRESS") {
          const noteSuffix = p.note ? ` Catatan: ${p.note}` : "";
          return `Perbaikan ${p.part || "perimeter"} di ${location} dikembalikan ke teknisi${actor}.${noteSuffix}`;
        }
        if (p.status === "RESOLVED") {
          return `Perbaikan ${p.part || "perimeter"} di ${location} telah diverifikasi dan disetujui${actor}.`;
        }
        return `Teknisi telah menyelesaikan penanganan ${p.part || "perimeter"} di ${location}${actor}. Menunggu verifikasi lapangan.`;
      },
    },
    STATUS_UPDATE_TECHNICIAN: {
      title: (p) => {
        const part = p.part || "Perimeter";
        if (p.status === "OPEN" && p.previousStatus === "IN_PROGRESS") {
          return `Perbaikan Dikembalikan · ${part}`;
        }
        if (p.status === "RESOLVED") {
          return `Perbaikan Diverifikasi · ${part}`;
        }
        return `Menunggu Verifikasi · ${part}`;
      },
      description: (p) => {
        const actor = p.actorName ? ` oleh ${p.actorName}` : "";
        const location = `Sisi ${p.side || "-"}${p.grid ? ` (Grid ${p.grid})` : ""}`;
        if (p.status === "OPEN" && p.previousStatus === "IN_PROGRESS") {
          const noteSuffix = p.note ? ` Catatan: ${p.note}` : "";
          return `Perbaikan di ${location} dikembalikan${actor} untuk penanganan ulang.${noteSuffix}`;
        }
        if (p.status === "RESOLVED") {
          return `Perbaikan di ${location} telah diverifikasi dan Diverifikasi ${actor}.`;
        }
        return `Perbaikan di ${location} telah dikirim${actor} dan menunggu verifikasi operator.`;
      },
    },
    REPORT_CLOSED_REPORTER: {
      title: () => "Laporan Ditutup oleh Operator",
      description: (p) =>
        `Laporan ${p.part || "perimeter"} di Sisi ${
          p.side || "-"
        } telah ditutup. Catatan: ${p.note || "Ditutup oleh operator"}`,
    },
    REPORT_CLOSED_TECHNICIAN: {
      title: () => "Laporan Ditutup",
      description: (p) =>
        `Laporan ${p.part || "perimeter"} di Sisi ${
          p.side || "-"
        } telah ditutup oleh operator pengendali.`,
    },
    SYSTEM_ALERT: {
      title: (p) => p.title || "Notifikasi Sistem",
      description: (p) => p.message || p.note || "-",
    },
  },

  en: {
    REPORT_NEW_OPERATOR: {
      title: (p) => `New Report · ${p.part || "Perimeter"}`,
      description: (p) =>
        `Damage reported on ${p.side || "-"} Side${
          p.grid ? ` (Grid ${p.grid})` : ""
        }. Awaiting operator review.`,
    },
    REPORT_NEW_TECHNICIAN: {
      title: (p) => `New Repair Task · ${p.part || "Perimeter"}`,
      description: (p) =>
        `Onsite repair required on ${p.side || "-"} Side${
          p.grid ? ` (Grid ${p.grid})` : ""
        }.`,
    },
    STATUS_UPDATE_REPORTER: {
      title: (p) => {
        if (p.status === "OPEN" && p.previousStatus === "IN_PROGRESS") {
          return "Repair Under Re-evaluation";
        }
        if (p.status === "RESOLVED") {
          return "Your Report Has Been Verified & Resolved";
        }
        return "Your Report Is Being Handled";
      },
      description: (p) => {
        const actor = p.actorName ? ` by ${p.actorName}` : "";
        if (p.status === "OPEN" && p.previousStatus === "IN_PROGRESS") {
          const noteSuffix = p.note ? ` Note: ${p.note}` : "";
          return `Repair work for ${p.part || "perimeter"} on ${
            p.side || "-"
          } Side${p.grid ? ` (Grid ${p.grid})` : ""} was returned to the technician${actor} for rework.${noteSuffix}`;
        }
        if (p.status === "RESOLVED") {
          return `Repair work for ${p.part || "perimeter"} on ${
            p.side || "-"
          } Side${p.grid ? ` (Grid ${p.grid})` : ""} has been verified and resolved${actor}.`;
        }
        return `Repair work for ${p.part || "perimeter"} on ${
          p.side || "-"
        } Side${p.grid ? ` (Grid ${p.grid})` : ""} has been handled${actor} and is awaiting operator verification.`;
      },
    },
    STATUS_UPDATE_OPERATOR: {
      title: (p) => {
        const part = p.part || "Perimeter";
        if (p.status === "OPEN" && p.previousStatus === "IN_PROGRESS") {
          return `Report Returned · ${part}`;
        }
        if (p.status === "RESOLVED") {
          return `Repair Approved · ${part}`;
        }
        if (p.status === "IN_PROGRESS") {
          return `Awaiting Verification · ${part}`;
        }
        const s = statusLabels[p.status || ""]?.en || p.status || "Status";
        return `Status Updated · ${s}`;
      },
      description: (p) => {
        const actor = p.actorName ? ` by ${p.actorName}` : "";
        const location = `${p.side || "-"} Side${p.grid ? ` (Grid ${p.grid})` : ""}`;
        if (p.status === "OPEN" && p.previousStatus === "IN_PROGRESS") {
          const noteSuffix = p.note ? ` Note: ${p.note}` : "";
          return `Repair for ${p.part || "perimeter"} on ${location} was returned to the technician${actor}.${noteSuffix}`;
        }
        if (p.status === "RESOLVED") {
          return `Repair for ${p.part || "perimeter"} on ${location} has been verified and approved${actor}.`;
        }
        return `Technician finished handling ${p.part || "perimeter"} on ${location}${actor}. Awaiting field verification.`;
      },
    },
    STATUS_UPDATE_TECHNICIAN: {
      title: (p) => {
        const part = p.part || "Perimeter";
        if (p.status === "OPEN" && p.previousStatus === "IN_PROGRESS") {
          return `Repair Returned · ${part}`;
        }
        if (p.status === "RESOLVED") {
          return `Repair Approved · ${part}`;
        }
        return `Awaiting Verification · ${part}`;
      },
      description: (p) => {
        const actor = p.actorName ? ` by ${p.actorName}` : "";
        const location = `${p.side || "-"} Side${p.grid ? ` (Grid ${p.grid})` : ""}`;
        if (p.status === "OPEN" && p.previousStatus === "IN_PROGRESS") {
          const noteSuffix = p.note ? ` Note: ${p.note}` : "";
          return `Repair on ${location} was returned${actor} for rework.${noteSuffix}`;
        }
        if (p.status === "RESOLVED") {
          return `Repair on ${location} has been verified and approved${actor}.`;
        }
        return `Repair on ${location} has been submitted${actor} and is awaiting operator verification.`;
      },
    },
    REPORT_CLOSED_REPORTER: {
      title: () => "Report Closed by Operator",
      description: (p) =>
        `Report for ${p.part || "perimeter"} on ${
          p.side || "-"
        } Side has been closed. Reason: ${p.note || "Closed by operator"}`,
    },
    REPORT_CLOSED_TECHNICIAN: {
      title: () => "Report Closed",
      description: (p) =>
        `Report for ${p.part || "perimeter"} on ${
          p.side || "-"
        } Side has been closed by control operator.`,
    },
    SYSTEM_ALERT: {
      title: (p) => p.title || "System Notification",
      description: (p) => p.message || p.note || "-",
    },
  },
};

/**
 * Resolves localized notification title and description based on template key & params.
 */
export function renderNotificationText(
  locale: string = "id",
  templateKey?: string | null,
  params?: Record<string, unknown> | null,
  fallbackTitle?: string | null,
  fallbackDescription?: string | null
): { title: string; description: string } {
  const safeLocale: "id" | "en" = locale === "en" ? "en" : "id";
  const templates = NOTIFICATION_TEMPLATES[safeLocale];

  const key = (templateKey as NotificationTemplateKey) || "SYSTEM_ALERT";
  const def = templates[key] || templates.SYSTEM_ALERT;

  const safeParams: NotificationParams = (params as NotificationParams) || {};
  if (fallbackTitle && !safeParams.title) safeParams.title = fallbackTitle;
  if (fallbackDescription && !safeParams.message) {
    safeParams.message = fallbackDescription;
  }

  try {
    return {
      title: def.title(safeParams) || fallbackTitle || "Notifikasi",
      description: def.description(safeParams) || fallbackDescription || "-",
    };
  } catch {
    return {
      title: fallbackTitle || "Notifikasi",
      description: fallbackDescription || "-",
    };
  }
}
