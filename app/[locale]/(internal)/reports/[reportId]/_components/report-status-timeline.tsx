"use client";

interface ReportStatusTimelineProps {
  reportId: string;
}

export function ReportStatusTimeline({ reportId }: ReportStatusTimelineProps) {
  return (
    <div className="rounded-lg border p-4">
      <h2 className="font-semibold">Riwayat Status Laporan ({reportId})</h2>
    </div>
  );
}
