import type { ReportRecord } from "@/app/[locale]/_lib/client-api";

/**
 * Filter reports strictly within [startDate, endDate] inclusive (YYYY-MM-DD format).
 * Normalized to Western Indonesia Time (WIB / UTC+7) boundary comparison to match airport local day.
 */
export function filterReportsByDateRange(
  reports: readonly ReportRecord[],
  startDate?: string,
  endDate?: string
): ReportRecord[] {
  if (!startDate && !endDate) return [...reports];

  const startMs = startDate ? new Date(`${startDate}T00:00:00.000+07:00`).getTime() : null;
  const endMs = endDate ? new Date(`${endDate}T23:59:59.999+07:00`).getTime() : null;

  return reports.filter((r) => {
    const dMs = new Date(r.createdAt).getTime();
    if (Number.isNaN(dMs)) return false;
    if (startMs !== null && dMs < startMs) return false;
    if (endMs !== null && dMs > endMs) return false;
    return true;
  });
}
