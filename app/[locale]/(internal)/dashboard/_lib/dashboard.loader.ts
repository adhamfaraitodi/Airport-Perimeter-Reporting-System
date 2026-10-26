import type {
  DashboardStatusSummary,
  MapReportMarker,
} from "./dashboard.schema";

export async function getDashboardMapData(): Promise<{
  summary: DashboardStatusSummary;
  markers: MapReportMarker[];
}> {
  // TODO: Query ringkasan status dan marker laporan aktif dari PostgreSQL via Drizzle
  return {
    summary: {
      total: 0,
      open: 0,
      inProgress: 0,
      resolved: 0,
      closed: 0,
    },
    markers: [],
  };
}
