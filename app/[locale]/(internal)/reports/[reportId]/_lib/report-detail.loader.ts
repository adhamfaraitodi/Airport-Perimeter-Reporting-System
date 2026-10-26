import { fetchReportById } from "./report-detail.service";

export async function getReportDetail(reportId: string) {
  return fetchReportById(reportId);
}
