// Unit test scaffold untuk reports.service.ts
import { getReportStatusLabel } from "./reports.service";

export function testReportStatusLabels() {
  const assertions = [
    getReportStatusLabel("OPEN") === "Baru",
    getReportStatusLabel("IN_PROGRESS") === "Ditangani",
    getReportStatusLabel("RESOLVED") === "Selesai",
    getReportStatusLabel("CLOSED") === "Ditutup",
    getReportStatusLabel("OPEN", true) === "Ditutup",
  ];
  return assertions.every(Boolean);
}
