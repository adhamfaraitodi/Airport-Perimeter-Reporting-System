"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type ReportRecord } from "../../../_lib/client-api";
import { ReportDetail } from "./_components/report-detail";

export default function ReportDetailPage() {
  const params = useParams<{ locale?: string; reportId: string }>();
  const router = useRouter();
  const locale = params?.locale || "id";
  const reportId = params?.reportId;
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .listReports()
      .then((items) => {
        const found = items.find((r) => r.id === reportId) || null;
        setReport(found);
      })
      .finally(() => setLoading(false));
  }, [reportId]);

  return (
    <div className="reporter-dashboard min-h-dvh bg-[var(--rd-bg)] p-4 sm:p-8 text-[var(--rd-text)]">
      <div className="mx-auto max-w-5xl">
        {loading ? (
          <div className="rounded-xl border-2 border-[var(--rd-border)] bg-[var(--rd-surface)] p-3.5 sm:p-6">
            <Skeleton className="mb-6 h-5 w-32 rounded-md" />
            <div className="mb-8 flex items-center gap-4">
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-48 rounded-md" />
                <Skeleton className="h-4 w-36 rounded-full" />
              </div>
            </div>
            <div className="mb-6 space-y-3">
              <Skeleton className="h-4 w-44 rounded-md" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
            <div className="mb-6 space-y-3">
              <Skeleton className="h-4 w-40 rounded-md" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-36 rounded-md" />
              <Skeleton className="h-[320px] w-full rounded-xl" />
            </div>
          </div>
        ) : (
          <ReportDetail
            report={report}
            onBack={() => router.push(`/${locale}/reports`)}
          />
        )}
      </div>
    </div>
  );
}
