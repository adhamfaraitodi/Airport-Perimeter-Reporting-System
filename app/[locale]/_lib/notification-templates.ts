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
  OPEN: { id: "Baru", en: "New" },
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
      title: (p) =>
        p.status === "RESOLVED"
          ? "Laporan Anda Selesai Ditangani"
          : "Laporan Anda Sedang Ditangani",
      description: (p) => {
        const isResolved = p.status === "RESOLVED";
        const actor = p.actorName ? ` oleh ${p.actorName}` : "";
        return `Perbaikan kerusakan ${p.part || "perimeter"} di Sisi ${
          p.side || "-"
        } telah ${isResolved ? "selesai" : "mulai ditangani"}${actor}.`;
      },
    },
    STATUS_UPDATE_OPERATOR: {
      title: (p) => {
        const s = statusLabels[p.status || ""]?.id || p.status || "Status";
        return `Status Diperbarui · ${s}`;
      },
      description: (p) => {
        const actor = p.actorName ? ` oleh ${p.actorName}` : "";
        return `Progres perbaikan ${p.part || "perimeter"} di Sisi ${
          p.side || "-"
        }${p.grid ? ` (Grid ${p.grid})` : ""}${actor}.`;
      },
    },
    STATUS_UPDATE_TECHNICIAN: {
      title: (p) => `Sedang Dikerjakan · ${p.part || "Perimeter"}`,
      description: (p) =>
        `Perbaikan di Sisi ${p.side || "-"}${
          p.grid ? ` (Grid ${p.grid})` : ""
        } menunggu verifikasi dan foto penyelesaian.`,
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
      title: (p) =>
        p.status === "RESOLVED"
          ? "Your Report Has Been Verified & Resolved"
          : "Your Report Is Being Handled",
      description: (p) => {
        const isResolved = p.status === "RESOLVED";
        const actor = p.actorName ? ` by ${p.actorName}` : "";
        return `Repair work for ${p.part || "perimeter"} on ${
          p.side || "-"
        } Side has been ${isResolved ? "completed" : "started"}${actor}.`;
      },
    },
    STATUS_UPDATE_OPERATOR: {
      title: (p) => {
        const s = statusLabels[p.status || ""]?.en || p.status || "Status";
        return `Status Updated · ${s}`;
      },
      description: (p) => {
        const actor = p.actorName ? ` by ${p.actorName}` : "";
        return `Repair progress for ${p.part || "perimeter"} on ${
          p.side || "-"
        } Side${p.grid ? ` (Grid ${p.grid})` : ""}${actor}.`;
      },
    },
    STATUS_UPDATE_TECHNICIAN: {
      title: (p) => `Work in Progress · ${p.part || "Perimeter"}`,
      description: (p) =>
        `Repair work on ${p.side || "-"} Side${
          p.grid ? ` (Grid ${p.grid})` : ""
        } awaiting completion photo proof.`,
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
