import fs from "fs";
import path from "path";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { FindingItem, LifecycleStatus, ReportRecord } from "../../../_lib/client-api";
import { dispatchReportNotificationAction } from "../../../_lib/notifications.actions";
import {
  type TechnicianStatus,
  type UpdateTechnicianStatusInput,
} from "./technician.schema";

const ALLOWED_TECHNICIAN_TRANSITIONS: Record<
  TechnicianStatus,
  TechnicianStatus[]
> = {
  OPEN: ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["OPEN"],
};

/**
 * Validates whether a state transition is permissible for a Technician.
 */
export function canTechnicianTransitionStatus(
  currentStatus: string,
  nextStatus: TechnicianStatus
): boolean {
  if (currentStatus === "CLOSED") return false;
  if (currentStatus === nextStatus) return false;

  const validNext =
    ALLOWED_TECHNICIAN_TRANSITIONS[currentStatus as TechnicianStatus];
  if (!validNext) return false;

  return validNext.includes(nextStatus);
}

/**
 * Helper to write uploaded base64 photos to the server filesystem under /public/uploads/reports/
 */
export function saveTechnicianPhotoFile(
  photoId: string,
  mimeType: string,
  base64Data: string
): { filePath: string; sizeBytes: number } {
  const cleaned = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(cleaned, "base64");
  const ext =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : "jpg";

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
 * Core business domain logic to execute a technician's status update on a report.
 * Guaranteed atomic via PostgreSQL transaction with audit logging and notifications.
 */
export async function executeTechnicianStatusUpdate(
  technicianUser: { id: string; name: string; role: string },
  input: UpdateTechnicianStatusInput
): Promise<ReportRecord> {
  const existingRows = await db
    .select()
    .from(schema.reports)
    .where(eq(schema.reports.id, input.reportId))
    .limit(1);

  if (existingRows.length === 0) {
    throw new Error("Laporan tidak ditemukan di sistem.");
  }

  const report = existingRows[0];

  if (report.deletedAt || report.status === "CLOSED") {
    throw new Error(
      "Laporan telah ditutup oleh Operator dan tidak dapat dimodifikasi lagi."
    );
  }

  if (input.expectedStatus && report.status !== input.expectedStatus) {
    throw new Error(
      `Status laporan telah diperbarui oleh pengguna lain (status terkini: "${report.status}"). Silakan muat ulang halaman.`
    );
  }

  if (!canTechnicianTransitionStatus(report.status, input.nextStatus)) {
    throw new Error(
      `Perubahan status dari "${report.status}" menjadi "${input.nextStatus}" tidak diizinkan untuk teknisi.`
    );
  }

  // Save all uploaded photos to server disk
  const savedPhotos = input.photos.map((photo) => {
    const saved = saveTechnicianPhotoFile(
      photo.id,
      photo.mimeType,
      photo.base64
    );
    return {
      id: photo.id,
      filePath: saved.filePath,
      mimeType: photo.mimeType,
      sizeBytes: saved.sizeBytes,
    };
  });

  const historyId = crypto.randomUUID();
  const now = new Date();

  // Execute atomic PostgreSQL transaction
  await db.transaction(async (tx) => {
    // 1. Audit trail: insert into report_status_history
    await tx.insert(schema.reportStatusHistory).values({
      id: historyId,
      reportId: report.id,
      actorId: technicianUser.id,
      previousStatus: report.status,
      newStatus: input.nextStatus,
      narrative: input.narrative.trim(),
      createdAt: now,
    });

    // 2. Photos: batch insert into report_photos with STATUS_UPDATE tag
    if (savedPhotos.length > 0) {
      await tx.insert(schema.reportPhotos).values(
        savedPhotos.map((p) => ({
          id: p.id,
          reportId: report.id,
          historyId,
          photoType: "STATUS_UPDATE" as const,
          filePath: p.filePath,
          mimeType: p.mimeType,
          sizeBytes: p.sizeBytes,
        }))
      );
    }

    // 3. Update report master row
    await tx
      .update(schema.reports)
      .set({
        status: input.nextStatus,
        updatedAt: now,
      })
      .where(eq(schema.reports.id, report.id));
  });

  // Dispatch notifications asynchronously
  const firstFinding = (report.findings as FindingItem[])?.[0];
  const partName =
    firstFinding?.partName || `Perimeter sisi ${report.side || "-"}`;

  dispatchReportNotificationAction({
    reportId: report.id,
    action: "STATUS",
    status: input.nextStatus,
    partName,
    side: report.side || undefined,
    segmentCode: report.segmentCode || undefined,
    actorName: technicianUser.name || "Teknisi Pemeliharaan",
    reporterId: report.reporterId,
  }).catch((err) => {
    console.error("Gagal mendispatch notifikasi teknisi:", err);
  });

  // Return the refreshed full ReportRecord
  const [updatedRow] = await db
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
    .leftJoin(schema.user, eq(schema.reports.reporterId, schema.user.id))
    .where(eq(schema.reports.id, report.id));

  const [allPhotos, allHistory] = await Promise.all([
    db
      .select()
      .from(schema.reportPhotos)
      .where(eq(schema.reportPhotos.reportId, report.id)),
    db
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
      .where(eq(schema.reportStatusHistory.reportId, report.id))
      .orderBy(schema.reportStatusHistory.createdAt),
  ]);

  const initialPhotos = allPhotos.filter(
    (p) => p.photoType === "REPORT_INITIAL"
  );

  const historyItems = allHistory.map((h) => {
    const histPhotos = allPhotos.filter((p) => p.historyId === h.id);
    return {
      id: h.id,
      status: h.newStatus as LifecycleStatus | "CLOSED",
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

  return {
    id: updatedRow.id,
    reporterId: updatedRow.reporterId,
    reporterName:
      updatedRow.reporterName ||
      updatedRow.reporterEmail ||
      "Petugas Lapangan",
    createdAt: updatedRow.createdAt.toISOString(),
    side: updatedRow.side || "",
    segmentCode: updatedRow.segmentCode || undefined,
    findings: (updatedRow.findings as FindingItem[]) || [],
    narrative: updatedRow.narrative,
    latitude: updatedRow.latitude,
    longitude: updatedRow.longitude,
    gps: updatedRow.gpsMetadata,
    locationSource: updatedRow.locationSource,
    status: updatedRow.status as LifecycleStatus,
    deletedAt: updatedRow.deletedAt ? updatedRow.deletedAt.toISOString() : null,
    deletionReason: updatedRow.deletionReason || "",
    images: initialPhotos.map((p) => ({
      id: p.id,
      url: p.filePath,
    })),
    history: historyItems,
  };
}
