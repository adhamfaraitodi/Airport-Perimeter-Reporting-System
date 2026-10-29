"use client";

import type { DashboardStatusSummary } from "../_lib/dashboard.schema";

interface ReportSummaryCardsProps {
  summary: DashboardStatusSummary;
}

export function ReportSummaryCards({ summary }: ReportSummaryCardsProps) {
  const cards = [
    { key: "total", label: "Total laporan", value: summary.total },
    { key: "OPEN", label: "Baru", value: summary.open },
    { key: "IN_PROGRESS", label: "Ditangani", value: summary.inProgress },
    { key: "RESOLVED", label: "Selesai", value: summary.resolved },
    { key: "CLOSED", label: "Ditutup", value: summary.closed },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map((card) => (
        <div key={card.key} className="rounded-lg border p-3">
          <div className="text-xs text-gray-500">{card.label}</div>
          <div className="text-xl font-bold">{card.value}</div>
        </div>
      ))}
    </div>
  );
}
