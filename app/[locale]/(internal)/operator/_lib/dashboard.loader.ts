import { isNull, sql } from "drizzle-orm";
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
  // Query all reports for summary counts and active map markers
  const allReports = await db
    .select({
      id: schema.reports.id,
      status: schema.reports.status,
      deletedAt: schema.reports.deletedAt,
      side: schema.reports.side,
      segmentCode: schema.reports.segmentCode,
      latitude: schema.reports.latitude,
      longitude: schema.reports.longitude,
    })
    .from(schema.reports);

  let open = 0;
  let inProgress = 0;
  let resolved = 0;
  let closed = 0;

  const markers: MapReportMarker[] = [];

  for (const r of allReports) {
    if (r.deletedAt || r.status === "CLOSED") {
      closed++;
    } else if (r.status === "OPEN") {
      open++;
    } else if (r.status === "IN_PROGRESS") {
      inProgress++;
    } else if (r.status === "RESOLVED") {
      resolved++;
    }

    // Only active reports become map markers
    if (!r.deletedAt && r.status !== "CLOSED") {
      const activeStatus = r.status as "OPEN" | "IN_PROGRESS" | "RESOLVED";
      markers.push({
        id: r.id,
        sideLocation: r.side ? `Sisi ${r.side}` : r.segmentCode || "Perimeter",
        latitude: r.latitude,
        longitude: r.longitude,
        status: activeStatus,
        statusLabel: STATUS_LABELS[activeStatus] || "Baru",
      });
    }
  }

  const total = open + inProgress + resolved;

  return {
    summary: {
      total,
      open,
      inProgress,
      resolved,
      closed,
    },
    markers,
  };
}
