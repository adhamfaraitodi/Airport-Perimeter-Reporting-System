import { filterReportsByDateRange } from "./date-filter";
import type { ReportRecord } from "@/app/[locale]/_lib/client-api";

function mockReport(id: string, createdAtIso: string): ReportRecord {
  return {
    id,
    reporterId: "u1",
    reporterName: "Test",
    createdAt: createdAtIso,
    side: "Utara",
    findings: [],
    narrative: "Test report",
    latitude: -7.9,
    longitude: 110.0,
    gps: null,
    locationSource: "GPS",
    status: "OPEN",
    deletedAt: null,
    deletionReason: "",
    images: [],
    history: [],
  };
}

export function runDateFilterTests(): boolean {
  console.log("Running date filter timezone regression tests...");

  // 2026-11-10 at 01:00 WIB = 2026-11-09T18:00:00.000Z (early morning patrol in Yogyakarta)
  const earlyMorningReport = mockReport("r-early", "2026-11-09T18:00:00.000Z");

  // 2026-11-09 at 23:59 WIB = 2026-11-09T16:59:59.000Z (previous night, should NOT be in 2026-11-10)
  const previousDayReport = mockReport("r-prev", "2026-11-09T16:59:59.000Z");

  // 2026-11-10 at 23:30 WIB = 2026-11-10T16:30:00.000Z (late night same day)
  const lateNightReport = mockReport("r-late", "2026-11-10T16:30:00.000Z");

  // 2026-11-11 at 00:30 WIB = 2026-11-10T17:30:00.000Z (next day, should NOT be in 2026-11-10)
  const nextDayReport = mockReport("r-next", "2026-11-10T17:30:00.000Z");

  const reports = [
    previousDayReport,
    earlyMorningReport,
    lateNightReport,
    nextDayReport,
  ];

  const filtered = filterReportsByDateRange(reports, "2026-11-10", "2026-11-10");
  const filteredIds = filtered.map((r) => r.id);

  if (!filteredIds.includes("r-early")) {
    throw new Error("FAIL: Early morning patrol report (01:00 WIB) was incorrectly excluded from 2026-11-10 filter");
  }

  if (!filteredIds.includes("r-late")) {
    throw new Error("FAIL: Late night report (23:30 WIB) was incorrectly excluded from 2026-11-10 filter");
  }

  if (filteredIds.includes("r-prev")) {
    throw new Error("FAIL: Previous day report (23:59 WIB on 2026-11-09) was incorrectly included in 2026-11-10 filter");
  }

  if (filteredIds.includes("r-next")) {
    throw new Error("FAIL: Next day report (00:30 WIB on 2026-11-11) was incorrectly included in 2026-11-10 filter");
  }

  console.log("All date filter timezone regression tests passed successfully!");
  return true;
}

runDateFilterTests();
