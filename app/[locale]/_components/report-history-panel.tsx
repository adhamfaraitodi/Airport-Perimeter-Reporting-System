"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Calendar,
  CalendarArrowDown,
  CalendarArrowUp,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardClock,
  ClipboardPen,
  ClipboardX,
  Download,
  Images,
  Loader2,
  MapPin,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n";
import type { ReportRecord } from "../_lib/client-api";
import { downloadAllReportsPdf } from "../_lib/report-document";

export const DEFAULT_PAGE_SIZE = 5;

export const REPORT_STATUS_FILTERS = [
  ["ALL", "Semua"],
  ["OPEN", "Baru"],
  ["IN_PROGRESS", "Ditangani"],
  ["RESOLVED", "Selesai"],
  ["CLOSED", "Ditutup"],
] as const;

export type FilterStatus = (typeof REPORT_STATUS_FILTERS)[number][0];

const statusIconMap: Record<string, typeof ClipboardClock> = {
  OPEN: ClipboardClock,
  IN_PROGRESS: ClipboardPen,
  RESOLVED: ClipboardCheck,
  CLOSED: ClipboardX,
};

const statusClassMap: Record<string, string> = {
  OPEN: "border-[var(--rd-danger)]/20 bg-[var(--rd-danger)]/10 text-[var(--rd-danger)]",
  IN_PROGRESS: "border-[var(--rd-amber)]/20 bg-[var(--rd-amber)]/10 text-[var(--rd-amber)]",
  RESOLVED: "border-[var(--rd-primary)]/20 bg-[var(--rd-primary)]/10 text-[var(--rd-primary)]",
  CLOSED: "border-slate-500/20 bg-slate-500/10 text-slate-400",
};

interface ReportCardProps {
  report: ReportRecord;
  isSelected?: boolean;
  onSelect: (report: ReportRecord) => void;
  statusLabels: Record<string, string>;
  formatDate: (dateStr: string) => string;
}

export function ReportHistoryCard({
  report,
  isSelected = false,
  onSelect,
  statusLabels,
  formatDate,
}: ReportCardProps) {
  const { t } = useTranslation();
  const effectiveStatus = report.deletedAt ? "CLOSED" : report.status;
  const StatusIcon = statusIconMap[effectiveStatus] || ClipboardClock;
  const statusClass =
    statusClassMap[effectiveStatus] ||
    "border-[var(--rd-border)] bg-[var(--rd-bg)] text-[var(--rd-text)]";

  const statusLabel =
    report.deletedAt
      ? t.historyPanel.statusMeta.CLOSED
      : statusLabels[effectiveStatus] || t.historyPanel.statusMeta.OPEN;

  const displayId = String(report.id).replace(/-/g, "").slice(0, 8).toUpperCase();

  const formattedDate = report.createdAt
    ? formatDate(report.createdAt)
    : t.historyPanel.dateUnavailable;

  const findingsText = useMemo(() => {
    if (!report.findings || report.findings.length === 0) return null;
    const parts = report.findings.map((f) => {
      const damages = Array.isArray(f.damages)
        ? f.damages.map((d) => (typeof d === "string" ? d : d.name)).join(", ")
        : "";
      return damages ? `${f.partName} (${damages})` : f.partName;
    });
    return parts.join("; ");
  }, [report.findings]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(report)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(report);
        }
      }}
      aria-label={`${t.historyPanel.openReportAria} ${displayId}, ${t.historyPanel.statusAria} ${statusLabel}`}
      className={`group relative flex cursor-pointer flex-col rounded-xl border border-solid p-3.5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--rd-primary)] sm:p-4 ${
        isSelected
          ? "border-[var(--rd-primary)] bg-[var(--rd-active)] shadow-sm"
          : "border-[var(--rd-border)] bg-[var(--rd-surface)] hover:border-[var(--rd-primary)]/40 hover:bg-[var(--rd-hover)] hover:shadow-xs"
      }`}
    >
      {/* Header: Status Pill & Time/ID */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-solid px-2.5 py-0.5 text-xs font-medium ${statusClass}`}
        >
          <StatusIcon size={13} aria-hidden="true" />
          <span>{statusLabel}</span>
        </span>

        <div className="flex items-center gap-1.5 text-xs text-[var(--rd-muted)]">
          <time dateTime={report.createdAt} className="hidden sm:inline">
            {formattedDate}
          </time>
          <span className="hidden sm:inline">·</span>
          <span className="font-mono text-[11px] text-[var(--rd-link)]">
            #{displayId}
          </span>
        </div>
      </div>

      {/* Date on mobile */}
      <div className="mb-1.5 text-[11px] text-[var(--rd-muted)] sm:hidden">
        {formattedDate}
      </div>

      {/* Findings title or perimeter side summary */}
      <h3 className="mb-1 text-sm font-semibold text-[var(--rd-text)] group-hover:text-[var(--rd-primary)]">
        {findingsText ||
          (report.side
            ? `${t.historyPanel.perimeterSide} ${report.side}`
            : t.historyPanel.findingsFallback)}
      </h3>

      {/* Narrative snippet */}
      <p className="line-clamp-2 text-xs leading-relaxed text-[var(--rd-muted)]">
        {report.narrative || t.historyPanel.noNarrative}
      </p>

      {/* Footer Info: Images count, Location Grid/Side, Reporter */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-solid border-[var(--rd-border)]/60 pt-2.5 text-[11px] text-[var(--rd-muted)]">
        {/* Images indicator */}
        {(report.images?.length || 0) > 0 && (
          <div className="flex items-center gap-1 text-[var(--rd-link)]">
            <Images size={13} aria-hidden="true" />
            <span>
              {report.images?.length || 0} {t.historyPanel.imagesCount}
            </span>
          </div>
        )}

        {/* Location Grid & Side */}
        <div className="flex items-center gap-1">
          <MapPin size={13} className="text-[var(--rd-link)]" aria-hidden="true" />
          <span>
            {report.segmentCode && report.side
              ? `${t.historyPanel.grid} ${report.segmentCode} · ${t.historyPanel.side} ${report.side}`
              : report.segmentCode
              ? `${t.historyPanel.grid} ${report.segmentCode}`
              : report.side
                ? `${t.historyPanel.side} ${report.side}`
                : t.historyPanel.unmappedSegment}
          </span>
        </div>

        {/* Reporter */}
        <div className="ml-auto flex items-center gap-1 text-[var(--rd-muted)]">
          <UserRound size={12} aria-hidden="true" />
          <span className="max-w-[120px] truncate sm:max-w-[180px]">
            {report.reporterName || t.historyPanel.reporterDefault}
          </span>
        </div>
      </div>
    </div>
  );
}

export interface ReportHistoryPanelProps {
  title?: string;
  reports: ReportRecord[];
  loading?: boolean;
  selectedId?: string | null;
  onSelect: (report: ReportRecord) => void;
  // External or default state handlers
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
  isNewestFirst?: boolean;
  onToggleSort?: () => void;
  // Customization
  pageSize?: number;
  filters?: readonly (readonly [string, string])[];
  headerAction?: ReactNode;
  showDownloadAll?: boolean;
  onDownloadAll?: (reports: ReportRecord[]) => void | Promise<void>;
  emptyMessage?: string;
  className?: string;
}

export function ReportHistoryPanel({
  title,
  reports = [],
  loading = false,
  selectedId = null,
  onSelect,
  searchQuery: controlledSearch,
  onSearchChange,
  activeFilter: controlledFilter,
  onFilterChange,
  isNewestFirst: controlledNewest,
  onToggleSort,
  pageSize = DEFAULT_PAGE_SIZE,
  filters,
  headerAction,
  showDownloadAll = true,
  onDownloadAll,
  emptyMessage,
  className = "",
}: ReportHistoryPanelProps) {
  const { t } = useTranslation();
  const [showDateModal, setShowDateModal] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Default dates: 3 months ago to today
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });

  const defaultFilters = useMemo<readonly (readonly [string, string])[]>(
    () => [
      ["ALL", t.historyPanel.filters.ALL],
      ["OPEN", t.historyPanel.filters.OPEN],
      ["IN_PROGRESS", t.historyPanel.filters.IN_PROGRESS],
      ["RESOLVED", t.historyPanel.filters.RESOLVED],
      ["CLOSED", t.historyPanel.filters.CLOSED],
    ],
    [t]
  );

  const activeFilters = filters ?? defaultFilters;
  const panelTitle = title ?? t.historyPanel.title;
  const panelEmptyMessage = emptyMessage ?? t.historyPanel.empty;

  // Internal state if uncontrolled
  const [internalSearch, setInternalSearch] = useState("");
  const [internalFilter, setInternalFilter] = useState("ALL");
  const [internalNewest, setInternalNewest] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const search = controlledSearch ?? internalSearch;
  const filter = controlledFilter ?? internalFilter;
  const newest = controlledNewest ?? internalNewest;

  const handleSearchChange = (val: string) => {
    setCurrentPage(1);
    if (onSearchChange) onSearchChange(val);
    else setInternalSearch(val);
  };

  const handleFilterChange = (val: string) => {
    setCurrentPage(1);
    if (onFilterChange) onFilterChange(val);
    else setInternalFilter(val);
  };

  const handleToggleSort = () => {
    if (onToggleSort) onToggleSort();
    else setInternalNewest((prev) => !prev);
  };

  // Filter reports matching the date range (ALL statuses included)
  const matchingReports = useMemo(() => {
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;
    return reports.filter((r) => {
      const d = new Date(r.createdAt);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [reports, startDate, endDate]);

  const handleConfirmDownload = async () => {
    if (downloadingPdf || matchingReports.length === 0) return;
    setDownloadingPdf(true);
    try {
      if (onDownloadAll) {
        await onDownloadAll(matchingReports);
      } else {
        await downloadAllReportsPdf(matchingReports, { startDate, endDate });
      }
      setShowDateModal(false);
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Filter & Search Logic for in-panel list
  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();

    return reports.filter((r) => {
      // 1. Filter status
      if (filter !== "ALL") {
        if (filter === "CLOSED") {
          if (!r.deletedAt) return false;
        } else {
          if (r.deletedAt || r.status !== filter) return false;
        }
      }

      // 2. Search query
      if (!q) return true;

      const findingsText = (r.findings || [])
        .flatMap((f) => [
          f.partName,
          ...(Array.isArray(f.damages)
            ? f.damages.map((d) => (typeof d === "string" ? d : d.name))
            : []),
        ])
        .join(" ");

      const haystack = `${r.id} ${r.segmentCode || ""} ${r.side || ""} ${
        r.narrative || ""
      } ${r.reporterName || ""} ${findingsText}`.toLowerCase();

      return haystack.includes(q);
    });
  }, [reports, filter, search]);

  // Sort
  const sortedReports = useMemo(() => {
    return [...filteredReports].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return (timeB - timeA) * (newest ? 1 : -1);
    });
  }, [filteredReports, newest]);

  // Pagination calculation
  const totalItems = sortedReports.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const currentReports = sortedReports.slice(startIndex, endIndex);

  // Generate pagination items: e.g. 1, 2, '...', 5
  const paginationRange = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    if (safePage <= 3) {
      pages.push(1, 2, 3, "...", totalPages);
    } else if (safePage >= totalPages - 2) {
      pages.push(1, "...", totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", safePage, "...", totalPages);
    }
    return pages;
  }, [totalPages, safePage]);

  const SortIcon = newest ? CalendarArrowDown : CalendarArrowUp;

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header title & Download Button */}
      <div className="flex items-center justify-between gap-3 pb-3">
        <h2 className="m-0 text-base font-normal text-[var(--rd-text)] sm:text-lg">
          {panelTitle}
        </h2>
        {headerAction ? (
          headerAction
        ) : showDownloadAll ? (
          <button
            type="button"
            disabled={reports.length === 0}
            onClick={() => setShowDateModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--rd-primary)] px-3.5 py-2 text-xs font-medium text-white shadow-xs transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            title={reports.length === 0 ? "Tidak ada laporan untuk diunduh" : "Unduh laporan (PDF Landscape)"}
          >
            <Download size={14} aria-hidden="true" />
            <span>{t.reports?.downloadPdf ?? "Unduh Laporan"}</span>
          </button>
        ) : null}
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <Search
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--rd-link)]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t.historyPanel.searchPlaceholder}
          className="w-full rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] py-2.5 pl-10 pr-4 text-xs text-[var(--rd-text)] outline-none transition-colors placeholder:text-[var(--rd-muted)] focus:border-[var(--rd-primary)] focus:ring-2 focus:ring-[var(--rd-active)] sm:text-sm"
          aria-label={t.historyPanel.searchAriaLabel}
        />
      </div>

      {/* Status Filter Tabs */}
      <div className="mb-2 flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
        {activeFilters.map(([val, label]) => {
          const isActive = filter === val;
          return (
            <button
              key={val}
              type="button"
              onClick={() => handleFilterChange(val)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs transition-colors ${
                isActive
                  ? "bg-[var(--rd-active)] text-[var(--rd-link)] font-medium"
                  : "bg-transparent text-[var(--rd-muted)] hover:bg-[var(--rd-hover)] hover:text-[var(--rd-text)]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Separator Line */}
      <div className="mb-3 border-b border-solid border-[var(--rd-border)]" />

      {/* Count & Sort Controls */}
      <div className="mb-3 flex items-center justify-between text-xs text-[var(--rd-muted)]">
        {loading ? (
          <Skeleton className="h-4 w-32 rounded" />
        ) : (
          <span>
            {totalItems} {t.historyPanel.foundReports}
          </span>
        )}
        <button
          type="button"
          onClick={handleToggleSort}
          title={
            newest
              ? t.historyPanel.sortNewestFirst
              : t.historyPanel.sortOldestFirst
          }
          className="inline-flex size-8 items-center justify-center rounded-lg text-[var(--rd-link)] transition-colors hover:bg-[var(--rd-active)]"
        >
          <SortIcon size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Card List Area */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-4 shadow-xs"
            >
              <div className="mb-3 flex items-center justify-between">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-28 rounded" />
              </div>
              <Skeleton className="mb-2 h-4 w-3/4 rounded" />
              <Skeleton className="mb-3 h-3 w-full rounded" />
              <div className="flex items-center gap-4 pt-2">
                <Skeleton className="h-3 w-16 rounded" />
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="ml-auto h-3 w-20 rounded" />
              </div>
            </div>
          ))
        ) : currentReports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--rd-border)] bg-[var(--rd-surface)]/50 p-8 text-center text-xs text-[var(--rd-muted)] sm:text-sm">
            {panelEmptyMessage}
          </div>
        ) : (
          currentReports.map((report) => (
            <ReportHistoryCard
              key={report.id}
              report={report}
              isSelected={report.id === selectedId}
              onSelect={onSelect}
              statusLabels={{
                OPEN: t.historyPanel.statusMeta.OPEN,
                IN_PROGRESS: t.historyPanel.statusMeta.IN_PROGRESS,
                RESOLVED: t.historyPanel.statusMeta.RESOLVED,
                CLOSED: t.historyPanel.statusMeta.CLOSED,
              }}
              formatDate={(iso) => {
                try {
                  return new Date(iso).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });
                } catch {
                  return iso;
                }
              }}
            />
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-solid border-[var(--rd-border)] pt-3 text-xs text-[var(--rd-muted)]">
          {/* Range Info */}
          <span>
            {t.historyPanel.showingRange} {startIndex + 1}–{endIndex}{" "}
            {t.historyPanel.of} {totalItems}
          </span>

          {/* Numeric Page Buttons */}
          <div className="flex items-center gap-1">
            {/* Prev Button */}
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex size-7 items-center justify-center rounded-md text-[var(--rd-text)] transition-colors hover:bg-[var(--rd-hover)] disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={t.historyPanel.prevPage}
            >
              <ChevronLeft size={16} />
            </button>

            {/* Page numbers */}
            {paginationRange.map((pageNum, idx) => {
              if (pageNum === "...") {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="inline-flex size-7 items-center justify-center text-[var(--rd-muted)]"
                  >
                    …
                  </span>
                );
              }

              const isCurrent = pageNum === safePage;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(Number(pageNum))}
                  className={`inline-flex size-7 items-center justify-center rounded-md text-xs transition-colors ${
                    isCurrent
                      ? "bg-[var(--rd-active)] text-[var(--rd-link)] font-medium"
                      : "text-[var(--rd-muted)] hover:bg-[var(--rd-hover)] hover:text-[var(--rd-text)]"
                  }`}
                  aria-current={isCurrent ? "page" : undefined}
                >
                  {pageNum}
                </button>
              );
            })}

            {/* Next Button */}
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex size-7 items-center justify-center rounded-md text-[var(--rd-text)] transition-colors hover:bg-[var(--rd-hover)] disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={t.historyPanel.nextPage}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Date Range Selection Popup Modal */}
      {showDateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="download-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => {
            if (!downloadingPdf) setShowDateModal(false);
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-5 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--rd-primary)]/10 text-[var(--rd-primary)]">
                  <Calendar size={18} aria-hidden="true" />
                </div>
                <div>
                  <h3 id="download-dialog-title" className="text-sm font-semibold text-[var(--rd-text)] sm:text-base">
                    Unduh Rekap Laporan
                  </h3>
                  <span className="text-[11px] text-[var(--rd-muted)]">
                    Format Dokumen Landscape (PDF A4)
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={downloadingPdf}
                onClick={() => setShowDateModal(false)}
                className="inline-flex size-7 items-center justify-center rounded-lg text-[var(--rd-muted)] transition-colors hover:bg-[var(--rd-hover)] hover:text-[var(--rd-text)]"
                aria-label="Tutup"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <p className="mb-4 text-xs leading-relaxed text-[var(--rd-muted)]">
              Pilih rentang tanggal laporan yang akan disertakan. Seluruh laporan dengan berbagai status (Baru, Ditangani, Selesai, Ditutup) dalam rentang ini akan diekspor.
            </p>

            {/* Date inputs */}
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--rd-text)]">
                  Tanggal Mulai
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={downloadingPdf}
                  className="w-full rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] px-3 py-2 text-xs text-[var(--rd-text)] outline-none transition-colors focus:border-[var(--rd-primary)] focus:ring-1 focus:ring-[var(--rd-primary)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--rd-text)]">
                  Tanggal Selesai
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={downloadingPdf}
                  className="w-full rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] px-3 py-2 text-xs text-[var(--rd-text)] outline-none transition-colors focus:border-[var(--rd-primary)] focus:ring-1 focus:ring-[var(--rd-primary)]"
                />
              </div>
            </div>

            {/* Summary info box */}
            <div className="mb-5 rounded-xl border border-solid border-[var(--rd-border)]/70 bg-[var(--rd-bg)]/60 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--rd-muted)]">Data siap diunduh:</span>
                <strong className={matchingReports.length > 0 ? "text-[var(--rd-primary)]" : "text-[var(--rd-coral)]"}>
                  {matchingReports.length} laporan
                </strong>
              </div>
              <span className="mt-1 block text-[11px] text-[var(--rd-muted)]">
                {matchingReports.length === 0
                  ? "Tidak ada laporan pada rentang tanggal ini."
                  : "Mencakup semua status: Baru, Ditangani, Selesai, dan Ditutup."}
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={downloadingPdf}
                onClick={() => setShowDateModal(false)}
                className="rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] px-4 py-2 text-xs font-medium text-[var(--rd-text)] transition-colors hover:bg-[var(--rd-hover)] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={
                  downloadingPdf ||
                  matchingReports.length === 0 ||
                  (!!startDate && !!endDate && startDate > endDate)
                }
                onClick={handleConfirmDownload}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--rd-primary)] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {downloadingPdf ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Download size={14} aria-hidden="true" />
                )}
                <span>{downloadingPdf ? "Menyiapkan PDF…" : "Unduh PDF Landscape"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
