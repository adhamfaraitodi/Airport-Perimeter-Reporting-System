"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Clipboard,
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

export function formatReportDate(
  value?: string | null,
  locale: string = "id",
  fallbackText: string = "Tanggal tidak tersedia"
) {
  if (!value) return fallbackText;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallbackText;
  const df = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
  return `${df.format(date)} WIB`;
}

export interface ReportCardItemProps {
  report: ReportRecord;
  selected?: boolean;
  onSelect: (report: ReportRecord) => void;
}

export function ReportCardItem({
  report,
  selected = false,
  onSelect,
}: ReportCardItemProps) {
  const { t, locale } = useTranslation();
  const effectiveStatus = report.deletedAt ? "CLOSED" : report.status;
  const StatusIcon = statusIconMap[effectiveStatus] || ClipboardClock;

  const statusLabels: Record<string, string> = {
    OPEN: t.historyPanel.statusMeta.OPEN,
    IN_PROGRESS: t.historyPanel.statusMeta.IN_PROGRESS,
    RESOLVED: t.historyPanel.statusMeta.RESOLVED,
    CLOSED: t.historyPanel.statusMeta.CLOSED,
  };
  const statusLabel =
    statusLabels[effectiveStatus] || t.historyPanel.statusMeta.OPEN;

  const findings = Array.isArray(report.findings) ? report.findings : [];
  const chips = findings
    .flatMap((f) => [
      f.partName,
      ...(Array.isArray(f.damages)
        ? f.damages.map((d) => (typeof d === "string" ? d : d.name))
        : []),
    ])
    .filter(
      (value): value is string => typeof value === "string" && !!value.trim()
    );

  const displayId = `#${String(report.id).slice(-6).toUpperCase()}`;

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
      className={`group flex w-full cursor-pointer items-start gap-3 rounded-2xl border border-solid p-3.5 text-left transition-colors sm:p-4 ${
        selected
          ? "border-[var(--rd-primary)] bg-[var(--rd-surface)] shadow-xs ring-2 ring-[var(--rd-active)]"
          : "border-[var(--rd-border)] bg-[var(--rd-surface)] hover:bg-[var(--rd-hover)] hover:border-[var(--rd-link)]/40"
      }`}
      aria-label={`${t.historyPanel.openReportAria} ${displayId}, ${t.historyPanel.statusAria} ${statusLabel}`}
    >
      {/* Left Icon Box using rd-status and CSS variables */}
      <div
        data-status={effectiveStatus}
        className="rd-status flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--rd-tint)] text-[var(--rd-status)] sm:size-12"
        aria-hidden="true"
      >
        <StatusIcon size={22} strokeWidth={1.9} />
      </div>

      {/* Main Body */}
      <div className="min-w-0 flex-1">
        {/* Top Header Row */}
        <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
          <span className="text-[var(--rd-muted)]">
            {displayId}
          </span>
          <span
            data-status={effectiveStatus}
            className="rd-status inline-flex items-center gap-1.5 rounded-full bg-[var(--rd-tint)] px-2.5 py-0.5 text-xs text-[var(--rd-status)]"
          >
            <span
              className="size-1.5 shrink-0 rounded-full bg-current"
              aria-hidden="true"
            />
            {statusLabel}
          </span>
          <time
            dateTime={report.createdAt}
            className="text-[11px] text-[var(--rd-muted)] sm:ml-auto"
          >
            {formatReportDate(
              report.createdAt,
              locale,
              t.historyPanel.dateUnavailable
            )}
          </time>
        </div>

        {/* Chips / Findings Badges */}
        {chips.length > 0 ? (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {chips.map((chip, idx) => (
              <span
                key={`${chip}-${idx}`}
                className="rounded-full bg-[var(--rd-active)] px-2.5 py-0.5 text-xs text-[var(--rd-link)]"
              >
                {chip}
              </span>
            ))}
          </div>
        ) : (
          <div className="mb-1 text-xs text-[var(--rd-muted)]">
            {report.side
              ? `${t.historyPanel.perimeterSide} ${report.side}`
              : t.historyPanel.findingsFallback}
          </div>
        )}

        {/* Narrative */}
        <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-[var(--rd-text)] sm:text-sm">
          {report.narrative || t.historyPanel.noNarrative}
        </p>

        {/* Meta Info Footer */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[var(--rd-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <Images
              size={15}
              className="text-[var(--rd-link)]"
              aria-hidden="true"
            />
            {report.images?.length || 0} {t.historyPanel.imagesCount}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin
              size={15}
              className="text-[var(--rd-link)]"
              aria-hidden="true"
            />
            {report.segmentCode && report.side
              ? `${t.historyPanel.grid} ${report.segmentCode} · ${t.historyPanel.side} ${report.side}`
              : report.segmentCode
              ? `${t.historyPanel.grid} ${report.segmentCode}`
              : report.side
                ? `${t.historyPanel.side} ${report.side}`
                : t.historyPanel.unmappedSegment}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <UserRound
              size={15}
              className="text-[var(--rd-link)]"
              aria-hidden="true"
            />
            {report.reporterName || t.historyPanel.reporterDefault}
          </span>
        </div>
      </div>
    </div>
  );
}

// Backward-compatible alias
export const ReportHistoryCard = ReportCardItem;

export interface ReportHistoryPanelProps {
  title?: string;
  reports?: ReportRecord[];
  loading?: boolean;
  selectedId?: string | number | null;
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
  showDownloadAll = false,
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
            className="inline-flex items-center gap-2 rounded-[10px] bg-[var(--rd-primary)] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            title={
              reports.length === 0
                ? "Tidak ada laporan untuk diunduh"
                : "Unduh laporan (PDF Landscape)"
            }
          >
            <Download size={15} aria-hidden="true" />
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
            <ReportCardItem
              key={report.id}
              report={report}
              selected={selectedId != null && String(report.id) === String(selectedId)}
              onSelect={onSelect}
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
                  <Clipboard size={18} aria-hidden="true" />
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
