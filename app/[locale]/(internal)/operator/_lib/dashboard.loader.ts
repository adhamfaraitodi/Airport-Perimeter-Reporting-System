import { and, isNull, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type {
  DashboardStatusSummary,
  MapReportMarker,
} from "./dashboard.schema";

const STATUS_LABELS: Record<string, "Baru" | "Ditangani" | "Selesai"> = {
  OPEN: "Baru",
  IN_PROGRESS: "Ditangani",
  RESOLVED: "Selesai",
};

export async function getDashboardMapData(): Promise<{
  summary: DashboardStatusSummary;
  markers: MapReportMarker[];
}> {
  // 1. Efficient SQL aggregation for status summary counters
  const [summaryRow] = await db
    .select({
      total: sql<number>`count(*) FILTER (WHERE ${schema.reports.deletedAt} IS NULL AND ${schema.reports.status} != 'CLOSED')::int`,
      open: sql<number>`count(*) FILTER (WHERE ${schema.reports.deletedAt} IS NULL AND ${schema.reports.status} = 'OPEN')::int`,
      inProgress: sql<number>`count(*) FILTER (WHERE ${schema.reports.deletedAt} IS NULL AND ${schema.reports.status} = 'IN_PROGRESS')::int`,
      resolved: sql<number>`count(*) FILTER (WHERE ${schema.reports.deletedAt} IS NULL AND ${schema.reports.status} = 'RESOLVED')::int`,
      closed: sql<number>`count(*) FILTER (WHERE ${schema.reports.deletedAt} IS NOT NULL OR ${schema.reports.status} = 'CLOSED')::int`,
    })
    .from(schema.reports);

  // 2. Fetch only active reports for map markers (uses partial index reports_active_idx)
  const activeReports = await db
    .select({
      id: schema.reports.id,
      status: schema.reports.status,
      side: schema.reports.side,
      segmentCode: schema.reports.segmentCode,
      latitude: schema.reports.latitude,
      longitude: schema.reports.longitude,
    })
    .from(schema.reports)
    .where(
      and(
        isNull(schema.reports.deletedAt),
        ne(schema.reports.status, "CLOSED")
      )
    );

  const markers: MapReportMarker[] = activeReports.map((r) => {
    const activeStatus = r.status as "OPEN" | "IN_PROGRESS" | "RESOLVED";
    return {
      id: r.id,
      sideLocation: r.side ? `Sisi ${r.side}` : r.segmentCode || "Perimeter",
      latitude: r.latitude,
      longitude: r.longitude,
      status: activeStatus,
      statusLabel: STATUS_LABELS[activeStatus] || "Baru",
    };
  });

  return {
    summary: {
      total: Number(summaryRow?.total || 0),
      open: Number(summaryRow?.open || 0),
      inProgress: Number(summaryRow?.inProgress || 0),
      resolved: Number(summaryRow?.resolved || 0),
      closed: Number(summaryRow?.closed || 0),
    },
    markers,
  };
}
