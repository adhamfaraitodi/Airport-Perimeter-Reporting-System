"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, type ReportRecord } from "../../../_lib/client-api";
import { ReportDetail } from "./_components/report-detail";

export default function ReportDetailPage() {
  const params = useParams<{ locale?: string; reportId: string }>();
  const router = useRouter();
  const locale = params?.locale || "id";
  const reportId = params?.reportId;
  const [report, setReport] = useState<ReportRecord | null>(null);

  useEffect(() => {
    api.listReports().then((items) => {
      const found = items.find((r) => r.id === reportId) || null;
      setReport(found);
    });
  }, [reportId]);

  return (
    <div className="reporter-dashboard min-h-dvh bg-[var(--rd-bg)] p-4 sm:p-8 text-[var(--rd-text)]">
      <div className="mx-auto max-w-5xl">
        <ReportDetail
          report={report}
          onBack={() => router.push(`/${locale}/reports`)}
        />
      </div>
    </div>
  );
}
