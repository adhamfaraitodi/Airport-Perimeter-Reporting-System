import { api, type ReportRecord } from "../../../../_lib/client-api";

export type ReportDetailData = ReportRecord;

export async function fetchReportById(
  reportId: string
): Promise<ReportRecord | null> {
  const list = await api.listReports();
  return list.find((item) => item.id === reportId) || null;
}
