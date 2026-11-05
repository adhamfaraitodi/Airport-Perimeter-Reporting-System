"use server";

import fs from "fs";
import path from "path";
import { headers } from "next/headers";
import { eq, desc, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { auth, type UserRole } from "@/lib/auth";
import type {
  ReportRecord,
  FindingItem,
  LifecycleStatus,
} from "../../../_lib/client-api";
import { dispatchReportNotificationAction } from "../../../_lib/notifications.actions";
import {
  commitReportSubmissionInputSchema,
  type UploadedFilePayload,
  type CommitReportSubmissionInput,
} from "./operator-reports.schema";

export type { UploadedFilePayload };

/**
 * Verify session for authenticated internal users.
 */
async function verifySession() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null);

  if (!session?.user?.id) {
    throw new Error("Sesi tidak valid. Silakan login kembali.");
  }

  return session.user;
}

/**
 * Helper to save base64 image to public/uploads/reports/ and return public URL.
 */
function saveReportPhotoFile(
  photoId: string,
  mimeType: string,
  base64Data: string
): { filePath: string; sizeBytes: number } {
  const cleaned = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(cleaned, "base64");
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const fileName = `${photoId}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "reports");

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const fullPath = path.join(dir, fileName);
  fs.writeFileSync(fullPath, buffer);

  return {
    filePath: `/uploads/reports/${fileName}`,
    sizeBytes: buffer.length,
  };
}

/**
 * Fetch all reports with reporter, photos, and status history from PostgreSQL.
 * Filters directly at the SQL layer when caller is a REPORTER to leverage reports_reporter_id_idx.
 */
export async function getReportsAction(): Promise<{
  success: boolean;
  reports: ReportRecord[];
  errorMessage?: string;
}> {
  try {
    const user = await verifySession();
    const userRole = (user as Record<string, unknown>).role as UserRole | undefined;

    // Fetch reports with SQL-level role filtering
    const baseQuery = db
      .select({
        id: schema.reports.id,
        reporterId: schema.reports.reporterId,
        status: schema.reports.status,
        side: schema.reports.side,
        segmentCode: schema.reports.segmentCode,
        latitude: schema.reports.latitude,
        longitude: schema.reports.longitude,
        locationSource: schema.reports.locationSource,
        findings: schema.reports.findings,
        gpsMetadata: schema.reports.gpsMetadata,
        narrative: schema.reports.narrative,
        deletedAt: schema.reports.deletedAt,
        deletionReason: schema.reports.deletionReason,
        createdAt: schema.reports.createdAt,
        reporterName: schema.user.name,
        reporterEmail: schema.user.email,
      })
      .from(schema.reports)
      .leftJoin(schema.user, eq(schema.reports.reporterId, schema.user.id));

    const filteredRows = await (userRole === "REPORTER"
      ? baseQuery.where(eq(schema.reports.reporterId, user.id))
      : baseQuery
    ).orderBy(desc(schema.reports.createdAt));

    if (filteredRows.length === 0) {
      return { success: true, reports: [] };
    }

    const reportIds = filteredRows.map((r) => r.id);

    // Fetch all photos for these reports
    const photoRows = await db
      .select()
      .from(schema.reportPhotos)
      .where(sql`${schema.reportPhotos.reportId} IN ${reportIds}`);

    // Fetch status history for these reports with actor name
    const historyRows = await db
      .select({
        id: schema.reportStatusHistory.id,
        reportId: schema.reportStatusHistory.reportId,
        actorId: schema.reportStatusHistory.actorId,
        actorName: schema.user.name,
        previousStatus: schema.reportStatusHistory.previousStatus,
        newStatus: schema.reportStatusHistory.newStatus,
        narrative: schema.reportStatusHistory.narrative,
        createdAt: schema.reportStatusHistory.createdAt,
      })
      .from(schema.reportStatusHistory)
      .leftJoin(
        schema.user,
        eq(schema.reportStatusHistory.actorId, schema.user.id)
      )
      .where(sql`${schema.reportStatusHistory.reportId} IN ${reportIds}`)
      .orderBy(schema.reportStatusHistory.createdAt);

    // Map rows to ReportRecord objects
    const reports: ReportRecord[] = filteredRows.map((r) => {
      const initialPhotos = photoRows.filter(
        (p) => p.reportId === r.id && p.photoType === "REPORT_INITIAL"
      );

      const reportHistories = historyRows.filter((h) => h.reportId === r.id);

      const historyItems = reportHistories.map((h) => {
        const histPhotos = photoRows.filter((p) => p.historyId === h.id);
        return {
          id: h.id,
          status: (h.newStatus === "CLOSED" ? "CLOSED" : h.newStatus) as LifecycleStatus | "CLOSED",
          previousStatus: h.previousStatus as LifecycleStatus | undefined,
          narrative: h.narrative,
          createdAt: h.createdAt.toISOString(),
          actorId: h.actorId,
          actorName: h.actorName || "Petugas",
          images: histPhotos.map((p) => ({
            id: p.id,
            url: p.filePath,
          })),
        };
      });

      const lifecycleStatus: LifecycleStatus =
        r.status === "CLOSED"
          ? "RESOLVED"
          : (r.status as LifecycleStatus);

      return {
        id: r.id,
        reporterId: r.reporterId,
        reporterName: r.reporterName || r.reporterEmail || "Petugas Lapangan",
        createdAt: r.createdAt.toISOString(),
        side: r.side || "",
        segmentCode: r.segmentCode || undefined,
        findings: (r.findings as FindingItem[]) || [],
        narrative: r.narrative,
        latitude: r.latitude,
        longitude: r.longitude,
        gps: r.gpsMetadata,
        locationSource: r.locationSource,
        status: lifecycleStatus,
        deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
        deletionReason: r.deletionReason || "",
        images: initialPhotos.map((p) => ({
          id: p.id,
          url: p.filePath,
        })),
        history: historyItems,
      };
    });

    return { success: true, reports };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memuat daftar laporan.";
    return { success: false, reports: [], errorMessage: msg };
  }
}

/**
 * Commit a full submission (CREATE, STATUS update, or DELETE/close) to PostgreSQL.
 * Uses atomic transactions and bulk photo batching for integrity.
 */
export async function commitReportSubmissionAction(input: CommitReportSubmissionInput): Promise<{
  success: boolean;
  report?: ReportRecord;
  errorMessage?: string;
}> {
  try {
    const user = await verifySession();
    const userRole = (user as Record<string, unknown>).role as UserRole | undefined;

    const parsed = commitReportSubmissionInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        errorMessage: parsed.error.issues[0]?.message || "Input pengiriman laporan tidak valid.",
      };
    }

    const { payload, files } = parsed.data;

    // Save photos to disk first
    const savedPhotos = files.map((f) => {
      const saved = saveReportPhotoFile(f.id, f.mimeType, f.base64);
      return {
        id: f.id,
        filePath: saved.filePath,
        mimeType: f.mimeType,
        sizeBytes: saved.sizeBytes,
      };
    });

    if (payload.action === "CREATE") {
      if (userRole !== "REPORTER" && userRole !== "OPERATOR") {
        throw new Error("Hanya Pelapor (Reporter) atau Operator yang dapat membuat laporan baru.");
      }

      const reportId = payload.id;
      const findingsJson = payload.findings || [];

      // Atomic transaction: Insert new report + batch insert initial photos
      await db.transaction(async (tx) => {
        await tx.insert(schema.reports).values({
          id: reportId,
          reporterId: user.id,
          status: "OPEN",
          side: payload.side || null,
          segmentCode: payload.segmentCode || null,
          latitude: payload.latitude!,
          longitude: payload.longitude!,
          locationSource: payload.locationSource || "MANUAL",
          findings: findingsJson as any,
          gpsMetadata: payload.gps || null,
          narrative: payload.narrative,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        if (savedPhotos.length > 0) {
          await tx.insert(schema.reportPhotos).values(
            savedPhotos.map((photo) => ({
              id: photo.id,
              reportId,
              photoType: "REPORT_INITIAL" as const,
              filePath: photo.filePath,
              mimeType: photo.mimeType,
              sizeBytes: photo.sizeBytes,
            }))
          );
        }
      });

      // Dispatch notification
      const firstFinding = payload.findings?.[0];
      const partName = firstFinding?.partName || `Perimeter sisi ${payload.side || "-"}`;
      dispatchReportNotificationAction({
        reportId,
        action: "CREATE",
        partName,
        side: payload.side,
        segmentCode: payload.segmentCode,
        actorName: user.name || "Pelapor",
        reporterId: user.id,
      }).catch(() => {});

      // Refetch full report
      const all = await getReportsAction();
      const created = all.reports.find((r) => r.id === reportId);
      return { success: true, report: created };
    }

    if (!payload.reportId) {
      throw new Error("ID laporan wajib disertakan untuk pembaruan status.");
    }

    const existingReport = await db
      .select()
      .from(schema.reports)
      .where(eq(schema.reports.id, payload.reportId))
      .limit(1);

    if (existingReport.length === 0) {
      throw new Error("Laporan tidak ditemukan.");
    }

    const report = existingReport[0];
    const previousStatus = report.status;

    if (payload.action === "DELETE") {
      if (userRole !== "OPERATOR") {
        throw new Error("Hanya Operator yang dapat menutup / menghapus laporan.");
      }

      const historyId = crypto.randomUUID();
      const now = new Date();

      // Atomic transaction: Insert history + batch close photos + update report
      await db.transaction(async (tx) => {
        await tx.insert(schema.reportStatusHistory).values({
          id: historyId,
          reportId: report.id,
          actorId: user.id,
          previousStatus,
          newStatus: "CLOSED",
          narrative: payload.narrative,
          createdAt: now,
        });

        if (savedPhotos.length > 0) {
          await tx.insert(schema.reportPhotos).values(
            savedPhotos.map((photo) => ({
              id: photo.id,
              reportId: report.id,
              historyId,
              photoType: "SOFT_DELETE" as const,
              filePath: photo.filePath,
              mimeType: photo.mimeType,
              sizeBytes: photo.sizeBytes,
            }))
          );
        }

        await tx
          .update(schema.reports)
          .set({
            status: "CLOSED",
            deletedAt: now,
            deletedBy: user.id,
            deletionReason: payload.narrative,
            updatedAt: now,
          })
          .where(eq(schema.reports.id, report.id));
      });

      // Notification
      const firstFinding = (report.findings as FindingItem[])?.[0];
      const partName = firstFinding?.partName || `Perimeter sisi ${report.side || "-"}`;
      dispatchReportNotificationAction({
        reportId: report.id,
        action: "DELETE",
        status: "CLOSED",
        partName,
        side: report.side || undefined,
        segmentCode: report.segmentCode || undefined,
        narrative: payload.narrative,
        actorName: user.name || "Operator",
        reporterId: report.reporterId,
      }).catch(() => {});

      const all = await getReportsAction();
      const updated = all.reports.find((r) => r.id === report.id);
      return { success: true, report: updated };
    }

    if (payload.action === "STATUS" && payload.status) {
      if (userRole !== "OPERATOR" && userRole !== "TECHNICIAN") {
        throw new Error(
          "Hanya Operator atau Teknisi yang berwenang memperbarui status penanganan laporan."
        );
      }

      if (report.deletedAt || report.status === "CLOSED") {
        throw new Error(
          "Laporan telah ditutup dan tidak dapat diubah statusnya."
        );
      }

      const historyId = crypto.randomUUID();
      const now = new Date();

      // Atomic transaction: Insert history + batch update photos + update report status
      await db.transaction(async (tx) => {
        await tx.insert(schema.reportStatusHistory).values({
          id: historyId,
          reportId: report.id,
          actorId: user.id,
          previousStatus,
          newStatus: payload.status!,
          narrative: payload.narrative,
          createdAt: now,
        });

        if (savedPhotos.length > 0) {
          await tx.insert(schema.reportPhotos).values(
            savedPhotos.map((photo) => ({
              id: photo.id,
              reportId: report.id,
              historyId,
              photoType: "STATUS_UPDATE" as const,
              filePath: photo.filePath,
              mimeType: photo.mimeType,
              sizeBytes: photo.sizeBytes,
            }))
          );
        }

        await tx
          .update(schema.reports)
          .set({
            status: payload.status,
            updatedAt: now,
          })
          .where(eq(schema.reports.id, report.id));
      });

      // Notification
      const firstFinding = (report.findings as FindingItem[])?.[0];
      const partName = firstFinding?.partName || `Perimeter sisi ${report.side || "-"}`;
      dispatchReportNotificationAction({
        reportId: report.id,
        action: "STATUS",
        status: payload.status,
        partName,
        side: report.side || undefined,
        segmentCode: report.segmentCode || undefined,
        actorName: user.name || "Petugas",
        reporterId: report.reporterId,
      }).catch(() => {});

      const all = await getReportsAction();
      const updated = all.reports.find((r) => r.id === report.id);
      return { success: true, report: updated };
    }

    throw new Error("Tindakan tidak dikenal.");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memproses pengiriman.";
    return { success: false, errorMessage: msg };
  }
}
