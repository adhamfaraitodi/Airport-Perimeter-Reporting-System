"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
        <nav
          aria-label="Breadcrumb"
          className="mb-3 flex flex-wrap items-center gap-2 text-xs md:text-[13px]"
        >
          <span className="text-[var(--rd-muted)]">Dashboard</span>
          <span className="text-[var(--rd-muted)]/50 select-none">/</span>
          <Link
            href={`/${locale}/reports`}
            className="text-[var(--rd-muted)] transition-colors hover:text-[var(--rd-link)]"
          >
            Laporan Saya
          </Link>
          <span className="text-[var(--rd-muted)]/50 select-none">/</span>
          <span className="font-medium text-[var(--rd-link)]">
            Detail Laporan{" "}
            {reportId ? `#${String(reportId).slice(-6).toUpperCase()}` : ""}
          </span>
        </nav>
        {loading ? (
          <article className="rounded-xl border-2 border-[var(--rd-border)] bg-[var(--rd-surface)] p-3.5 text-[var(--rd-text)] sm:p-6">
            <button
              type="button"
              onClick={() => router.push(`/${locale}/reports`)}
              className="mb-6 inline-flex min-h-9 items-center gap-1.5 rounded-lg border-0 bg-transparent px-0 py-1 text-xs text-[var(--rd-muted)] hover:text-[var(--rd-link)]"
            >
              <ArrowLeft
                size={18}
                className="text-[var(--rd-link)]"
                aria-hidden="true"
              />
              Daftar Laporan
            </button>
            <div className="mb-8 flex items-center gap-4">
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-base">
                  <span>Detail laporan</span>
                  <Skeleton className="h-5 w-20 rounded-md" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-3.5 w-28 rounded" />
                </div>
              </div>
            </div>
            <section className="mb-6">
              <h3 className="m-0 mb-3 text-base font-normal">
                Bagian dan Jenis Kerusakan
              </h3>
              <Skeleton className="h-20 w-full rounded-lg" />
            </section>
            <section className="mb-6">
              <h3 className="m-0 mb-3 text-base font-normal">
                Narasi Laporan Temuan
              </h3>
              <Skeleton className="h-24 w-full rounded-lg" />
            </section>
            <section className="mb-6">
              <h3 className="m-0 mb-3 text-base font-normal">
                Foto-foto Laporan Temuan
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <Skeleton className="aspect-square w-full rounded-lg" />
                <Skeleton className="aspect-square w-full rounded-lg" />
              </div>
            </section>
            <section className="mb-7">
              <h3 className="m-0 mb-3 text-base font-normal">
                Lokasi kejadian
              </h3>
              <Skeleton className="mb-2 h-4 w-64 rounded" />
              <Skeleton className="h-[320px] w-full rounded-xl" />
            </section>
          </article>
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
