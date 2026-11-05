"use server";

import { headers } from "next/headers";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { auth, type UserRole } from "@/lib/auth";
import {
  renderNotificationText,
  type NotificationTemplateKey,
} from "./notification-templates";

export interface NotificationDto {
  id: string;
  reportId?: string | null;
  templateKey?: string;
  title: string;
  description: string;
  time: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  read: boolean;
  createdAt: string;
}

export interface GetNotificationsResult {
  success: boolean;
  items: NotificationDto[];
  unreadCount: number;
  errorMessage?: string;
}

function formatRelativeTimeId(date: Date, locale: string = "id"): string {
  const isEn = locale === "en";
  const now = Date.now();
  const diffSec = Math.floor((now - date.getTime()) / 1000);

  if (diffSec < 60) return isEn ? "Just now" : "Baru saja";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return isEn ? `${diffMin}m ago` : `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return isEn ? `${diffHour}h ago` : `${diffHour} jam lalu`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) {
    const timeStr = date.toLocaleTimeString(isEn ? "en-US" : "id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return isEn ? `Yesterday, ${timeStr}` : `Kemarin, ${timeStr} WIB`;
  }
  if (diffDay < 7) return isEn ? `${diffDay}d ago` : `${diffDay} hari lalu`;

  return date.toLocaleDateString(isEn ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Resolve authenticated user ID and role from Better-Auth session,
 * with fallback for local demo.
 */
async function resolveCurrentActor(): Promise<{
  userId: string;
  role: UserRole;
} | null> {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null);

    if (session?.user?.id) {
      const rawRole = (session.user as Record<string, unknown>).role as string | undefined;
      const role: UserRole =
        rawRole === "OPERATOR" || rawRole === "TECHNICIAN" ? rawRole : "REPORTER";
      return { userId: session.user.id, role };
    }
  } catch {
    // ignore
  }

  // Fallback for development if no session cookie
  const fallback = await db.query.user.findFirst();
  if (fallback) {
    return {
      userId: fallback.id,
      role: fallback.role as UserRole,
    };
  }

  return null;
}

/**
 * Fetch notifications targeted to the current user with full i18n support:
 * - Broadcasts to user's role (e.g. OPERATOR or TECHNICIAN)
 * - Broadcasts to ALL
 * - Specific personal notifications sent to user's ID (e.g. REPORTER of their own report)
 * - Automatically renders localized title & description based on active [locale]
 */
export async function getNotificationsAction(
  locale: string = "id"
): Promise<GetNotificationsResult> {
  try {
    const actor = await resolveCurrentActor();
    if (!actor) {
      return { success: true, items: [], unreadCount: 0 };
    }

    const rows = await db
      .select({
        id: schema.notification.id,
        reportId: schema.notification.reportId,
        category: schema.notification.category,
        status: schema.notification.status,
        templateKey: schema.notification.templateKey,
        params: schema.notification.params,
        title: schema.notification.title,
        description: schema.notification.description,
        targetRole: schema.notification.targetRole,
        targetUserId: schema.notification.targetUserId,
        createdAt: schema.notification.createdAt,
        readAt: schema.notificationRead.readAt,
      })
      .from(schema.notification)
      .leftJoin(
        schema.notificationRead,
        and(
          eq(schema.notificationRead.notificationId, schema.notification.id),
          eq(schema.notificationRead.userId, actor.userId)
        )
      )
      .where(
        or(
          eq(schema.notification.targetUserId, actor.userId),
          eq(schema.notification.targetRole, actor.role),
          eq(schema.notification.targetRole, "ALL")
        )
      )
      .orderBy(desc(schema.notification.createdAt))
      .limit(30);

    const items: NotificationDto[] = rows.map((r) => {
      const rawStatus = (r.status as string) || "OPEN";
      const validStatus: "OPEN" | "IN_PROGRESS" | "RESOLVED" =
        rawStatus === "RESOLVED"
          ? "RESOLVED"
          : rawStatus === "IN_PROGRESS"
            ? "IN_PROGRESS"
            : "OPEN";

      // Render i18n title & description from structured template key + params
      const rendered = renderNotificationText(
        locale,
        r.templateKey,
        r.params,
        r.title,
        r.description
      );

      return {
        id: r.id,
        reportId: r.reportId,
        templateKey: r.templateKey,
        title: rendered.title,
        description: rendered.description,
        time: formatRelativeTimeId(new Date(r.createdAt), locale),
        status: validStatus,
        read: r.readAt !== null,
        createdAt: new Date(r.createdAt).toISOString(),
      };
    });

    const unreadCount = items.filter((n) => !n.read).length;

    return {
      success: true,
      items,
      unreadCount,
    };
  } catch (err) {
    console.error("getNotificationsAction error:", err);
    return {
      success: false,
      items: [],
      unreadCount: 0,
      errorMessage: "Gagal memuat daftar notifikasi.",
    };
  }
}

/**
 * Mark a single notification as read for current user.
 */
export async function markNotificationReadAction(notificationId: string): Promise<{
  success: boolean;
}> {
  try {
    const actor = await resolveCurrentActor();
    if (!actor) return { success: false };

    await db
      .insert(schema.notificationRead)
      .values({
        userId: actor.userId,
        notificationId,
        readAt: new Date(),
      })
      .onConflictDoNothing();

    return { success: true };
  } catch (err) {
    console.error("markNotificationReadAction error:", err);
    return { success: false };
  }
}

/**
 * Mark all notifications as read for current user.
 */
export async function markAllNotificationsReadAction(): Promise<{
  success: boolean;
}> {
  try {
    const actor = await resolveCurrentActor();
    if (!actor) return { success: false };

    // Find all unread notification IDs targeted to this user
    const rows = await db
      .select({ id: schema.notification.id })
      .from(schema.notification)
      .leftJoin(
        schema.notificationRead,
        and(
          eq(schema.notificationRead.notificationId, schema.notification.id),
          eq(schema.notificationRead.userId, actor.userId)
        )
      )
      .where(
        and(
          or(
            eq(schema.notification.targetUserId, actor.userId),
            eq(schema.notification.targetRole, actor.role),
            eq(schema.notification.targetRole, "ALL")
          ),
          isNull(schema.notificationRead.readAt)
        )
      );

    if (rows.length === 0) {
      return { success: true };
    }

    const now = new Date();
    await db
      .insert(schema.notificationRead)
      .values(
        rows.map((r) => ({
          userId: actor.userId,
          notificationId: r.id,
          readAt: now,
        }))
      )
      .onConflictDoNothing();

    return { success: true };
  } catch (err) {
    console.error("markAllNotificationsReadAction error:", err);
    return { success: false };
  }
}

/**
 * Dispatch / create a parameterized i18n notification in database:
 * - Stores lightweight templateKey + params JSONB.
 * - Leaves title and description null for 100% database storage efficiency.
 */
export async function createNotificationEvent(payload: {
  reportId?: string | null;
  category: "REPORT_NEW" | "STATUS_UPDATE" | "REPORT_CLOSED" | "SYSTEM";
  status?: string | null;
  templateKey: NotificationTemplateKey;
  params?: Record<string, unknown>;
  title?: string | null;
  description?: string | null;
  targetRole?: UserRole | "ALL" | null;
  targetUserId?: string | null;
}): Promise<string> {
  const [created] = await db
    .insert(schema.notification)
    .values({
      reportId: payload.reportId || null,
      category: payload.category,
      status: payload.status || "OPEN",
      templateKey: payload.templateKey,
      params: payload.params || {},
      title: payload.title || null,
      description: payload.description || null,
      targetRole: payload.targetRole || null,
      targetUserId: payload.targetUserId || null,
      createdAt: new Date(),
    })
    .returning({ id: schema.notification.id });

  return created.id;
}

/**
 * Dispatch contextual notifications based on operational report actions:
 * 1. CREATE:
 *    - Broadcast to OPERATOR: "REPORT_NEW_OPERATOR"
 *    - Broadcast to TECHNICIAN: "REPORT_NEW_TECHNICIAN"
 * 2. STATUS (IN_PROGRESS or RESOLVED):
 *    - Personal to REPORTER: "STATUS_UPDATE_REPORTER" (specific to report owner)
 *    - Broadcast to OPERATOR: "STATUS_UPDATE_OPERATOR"
 *    - Broadcast to TECHNICIAN: "STATUS_UPDATE_TECHNICIAN"
 * 3. DELETE (CLOSED):
 *    - Personal to REPORTER: "REPORT_CLOSED_REPORTER"
 *    - Broadcast to TECHNICIAN: "REPORT_CLOSED_TECHNICIAN"
 */
export async function dispatchReportNotificationAction(params: {
  reportId: string;
  action: "CREATE" | "STATUS" | "DELETE";
  status?: string;
  side?: string;
  segmentCode?: string;
  partName?: string;
  narrative?: string;
  reporterId?: string;
  actorName?: string;
}): Promise<void> {
  try {
    const part = params.partName || "Perimeter";
    const side = params.side || "-";
    const grid = params.segmentCode || "";

    // Resolve target reporter UUID if personal notification needed
    let reporterUserId: string | null = null;
    if (params.reporterId) {
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          params.reporterId
        )
      ) {
        reporterUserId = params.reporterId;
      } else {
        const rUser = await db.query.user.findFirst({
          where: eq(schema.user.role, "REPORTER"),
        });
        reporterUserId = rUser?.id || null;
      }
    }

    if (params.action === "CREATE") {
      // 1. Broadcast to Operator
      await createNotificationEvent({
        reportId: params.reportId,
        category: "REPORT_NEW",
        status: "OPEN",
        templateKey: "REPORT_NEW_OPERATOR",
        params: { part, side, grid },
        targetRole: "OPERATOR",
      });

      // 2. Broadcast to Technician
      await createNotificationEvent({
        reportId: params.reportId,
        category: "REPORT_NEW",
        status: "OPEN",
        templateKey: "REPORT_NEW_TECHNICIAN",
        params: { part, side, grid },
        targetRole: "TECHNICIAN",
      });
    } else if (params.action === "STATUS") {
      // 1. Personal Notification specifically for the reporter of this report
      if (reporterUserId) {
        await createNotificationEvent({
          reportId: params.reportId,
          category: "STATUS_UPDATE",
          status: params.status || "IN_PROGRESS",
          templateKey: "STATUS_UPDATE_REPORTER",
          params: {
            part,
            side,
            grid,
            status: params.status || "IN_PROGRESS",
            actorName: params.actorName,
          },
          targetUserId: reporterUserId,
        });
      }

      // 2. Broadcast to Operator
      await createNotificationEvent({
        reportId: params.reportId,
        category: "STATUS_UPDATE",
        status: params.status || "IN_PROGRESS",
        templateKey: "STATUS_UPDATE_OPERATOR",
        params: {
          part,
          side,
          grid,
          status: params.status || "IN_PROGRESS",
          actorName: params.actorName,
        },
        targetRole: "OPERATOR",
      });

      // 3. Broadcast to Technician
      await createNotificationEvent({
        reportId: params.reportId,
        category: "STATUS_UPDATE",
        status: params.status || "IN_PROGRESS",
        templateKey: "STATUS_UPDATE_TECHNICIAN",
        params: {
          part,
          side,
          grid,
          status: params.status || "IN_PROGRESS",
          actorName: params.actorName,
        },
        targetRole: "TECHNICIAN",
      });
    } else if (params.action === "DELETE") {
      // 1. Personal to reporter
      if (reporterUserId) {
        await createNotificationEvent({
          reportId: params.reportId,
          category: "REPORT_CLOSED",
          status: "CLOSED",
          templateKey: "REPORT_CLOSED_REPORTER",
          params: {
            part,
            side,
            grid,
            note: params.narrative || "Ditutup oleh operator",
          },
          targetUserId: reporterUserId,
        });
      }

      // 2. Broadcast to Technician
      await createNotificationEvent({
        reportId: params.reportId,
        category: "REPORT_CLOSED",
        status: "CLOSED",
        templateKey: "REPORT_CLOSED_TECHNICIAN",
        params: { part, side, grid },
        targetRole: "TECHNICIAN",
      });
    }
  } catch (err) {
    console.error("dispatchReportNotificationAction error:", err);
  }
}
