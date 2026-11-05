import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type {
  FindingItem,
  LifecycleStatus,
  ReportRecord,
} from "../../../_lib/client-api";
import type { TechnicianTaskSummary } from "./technician.schema";

/**
 * High-performance database loader for the Technician dashboard.
 * Queries aggregated counter badges and active reports list leveraging PostgreSQL indexes.
 */
export async function getTechnicianReports(): Promise<{
  summary: TechnicianTaskSummary;
  reports: ReportRecord[];
}> {
  // 1. Single round-trip aggregation for badge counters using SQL FILTER
  const [summaryRow] = await db
    .select({
      totalActive: sql<number>`count(*) FILTER (WHERE ${schema.reports.deletedAt} IS NULL AND ${schema.reports.status} != 'CLOSED')::int`,
      open: sql<number>`count(*) FILTER (WHERE ${schema.reports.deletedAt} IS NULL AND ${schema.reports.status} = 'OPEN')::int`,
      inProgress: sql<number>`count(*) FILTER (WHERE ${schema.reports.deletedAt} IS NULL AND ${schema.reports.status} = 'IN_PROGRESS')::int`,
      resolved: sql<number>`count(*) FILTER (WHERE ${schema.reports.deletedAt} IS NULL AND ${schema.reports.status} = 'RESOLVED')::int`,
    })
    .from(schema.reports);

  // 2. Query active reports (leverages partial index: reports_active_idx)
  const reportRows = await db
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
    .where(
      and(
        isNull(schema.reports.deletedAt),
        ne(schema.reports.status, "CLOSED")
      )
    )
    .orderBy(desc(schema.reports.createdAt));

  const summary: TechnicianTaskSummary = {
    totalActive: Number(summaryRow?.totalActive || 0),
    open: Number(summaryRow?.open || 0),
    inProgress: Number(summaryRow?.inProgress || 0),
    resolved: Number(summaryRow?.resolved || 0),
  };

  if (reportRows.length === 0) {
    return { summary, reports: [] };
  }

  const reportIds = reportRows.map((r) => r.id);

  // 3. Batch fetch photos and status history in parallel
  const [photoRows, historyRows] = await Promise.all([
    db
      .select()
      .from(schema.reportPhotos)
      .where(sql`${schema.reportPhotos.reportId} IN ${reportIds}`),
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
      .where(sql`${schema.reportStatusHistory.reportId} IN ${reportIds}`)
      .orderBy(schema.reportStatusHistory.createdAt),
  ]);

  // Map to frontend ReportRecord interface
  const reports: ReportRecord[] = reportRows.map((r) => {
    const initialPhotos = photoRows.filter(
      (p) => p.reportId === r.id && p.photoType === "REPORT_INITIAL"
    );

    const reportHistories = historyRows.filter((h) => h.reportId === r.id);

    const historyItems = reportHistories.map((h) => {
      const histPhotos = photoRows.filter((p) => p.historyId === h.id);
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
      status: r.status as LifecycleStatus,
      deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
      deletionReason: r.deletionReason || "",
      images: initialPhotos.map((p) => ({
        id: p.id,
        url: p.filePath,
      })),
      history: historyItems,
    };
  });

  return { summary, reports };
}
