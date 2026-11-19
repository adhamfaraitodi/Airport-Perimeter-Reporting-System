import type { UserRole } from "@/lib/auth";
import type {
  LifecycleStatus,
  ReportHistoryItem,
  ReportRecord,
} from "@/app/[locale]/_lib/client-api";

export interface ApprovalInfo {
  actorName: string;
  actorRole?: UserRole;
  createdAt: string;
}

/**
 * Validates whether a given user role is permitted to transition a report
 * from currentStatus to nextStatus under the two-stage repair verification workflow.
 */
export function canRoleTransitionReportStatus(
  role: UserRole | string | undefined,
  currentStatus: string,
  nextStatus: LifecycleStatus
): boolean {
  if (currentStatus === "CLOSED" || currentStatus === nextStatus) {
    return false;
  }

  if (role === "TECHNICIAN") {
    return currentStatus === "OPEN" && nextStatus === "IN_PROGRESS";
  }

  if (role === "OPERATOR" || role === "CHIEF") {
    return (
      currentStatus === "IN_PROGRESS" &&
      (nextStatus === "RESOLVED" || nextStatus === "OPEN")
    );
  }

  return false;
}

/**
 * Validates whether a given user role is permitted to close / archive a report.
 * Reports that are already RESOLVED or CLOSED cannot be closed.
 */
export function canRoleCloseReport(
  role: UserRole | string | undefined,
  currentStatus?: string
): boolean {
  if (currentStatus === "RESOLVED" || currentStatus === "CLOSED") {
    return false;
  }
  return role === "OPERATOR" || role === "CHIEF";
}

/**
 * Extracts approval info from the latest RESOLVED history entry for a non-deleted RESOLVED report.
 */
export function getApprovalInfo(
  report: Pick<ReportRecord, "status" | "deletedAt" | "history">
): ApprovalInfo | null {
  if (report.deletedAt || report.status !== "RESOLVED") {
    return null;
  }

  const resolvedEntries = (report.history || []).filter(
    (h) => h.status === "RESOLVED"
  );
  if (resolvedEntries.length === 0) {
    return null;
  }

  let latest = resolvedEntries[0];
  for (const entry of resolvedEntries) {
    const entryTime = Date.parse(entry.createdAt);
    const latestTime = Date.parse(latest.createdAt);
    if (
      !Number.isNaN(entryTime) &&
      !Number.isNaN(latestTime) &&
      entryTime >= latestTime
    ) {
      latest = entry;
    } else if (Number.isNaN(entryTime) || Number.isNaN(latestTime)) {
      latest = entry;
    }
  }

  return {
    actorName: latest.actorName,
    actorRole: latest.actorRole,
    createdAt: latest.createdAt,
  };
}

/**
 * Formats a localized approval label ("Disetujui oleh Chief Andi" / "Approved by Operator Budi").
 */
export function formatApprovalLabel(
  info: Pick<ApprovalInfo, "actorName" | "actorRole">,
  locale: string = "id"
): string {
  const isEn = locale === "en";
  const roleLabel = info.actorRole === "CHIEF" ? "Chief" : "Operator";
  const prefix = isEn ? "Approved by" : "Disetujui oleh";
  return `${prefix} ${roleLabel} ${info.actorName}`.trim();
}

/**
 * Checks whether a status history entry represents a report returned for revision
 * from IN_PROGRESS back to OPEN by an Operator or Chief.
 */
export function isReturnedHistoryItem(
  item: Pick<ReportHistoryItem, "status" | "previousStatus">
): boolean {
  return item.status === "OPEN" && item.previousStatus === "IN_PROGRESS";
}
