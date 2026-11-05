"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  CalendarArrowDown,
  CalendarArrowUp,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardClock,
  ClipboardPen,
  ClipboardX,
  Images,
  MapPin,
  Search,
  UserRound,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportRecord } from "../_lib/client-api";

export const DEFAULT_PAGE_SIZE = 5;

export const REPORT_STATUS_FILTERS = [
  ["ALL", "Semua"],
  ["OPEN", "Baru"],
  ["IN_PROGRESS", "Ditangani"],
  ["RESOLVED", "Selesai"],
  ["CLOSED", "Ditutup"],
] as const;

export type FilterStatus = (typeof REPORT_STATUS_FILTERS)[number][0];

const statusMeta: Record<
  string,
  {
    label: string;
    icon: typeof ClipboardClock;
  }
> = {
  OPEN: {
    label: "Baru",
    icon: ClipboardClock,
  },
  IN_PROGRESS: {
    label: "Sedang ditangani",
    icon: ClipboardPen,
  },
  RESOLVED: {
    label: "Selesai",
    icon: ClipboardCheck,
  },
  CLOSED: {
    label: "Ditutup",
    icon: ClipboardX,
  },
};

const dateFormat = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

export function formatReportDate(value?: string | null) {
  if (!value) return "Tanggal tidak tersedia";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Tanggal tidak tersedia"
    : `${dateFormat.format(date)} WIB`;
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
  const effectiveStatus = report.deletedAt ? "CLOSED" : report.status;
  const meta = statusMeta[effectiveStatus] || statusMeta.OPEN;
  const StatusIcon = meta.icon;

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
      aria-label={`Buka laporan ${displayId}, status ${meta.label}`}
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
            {meta.label}
          </span>
          <time
            dateTime={report.createdAt}
            className="text-[11px] text-[var(--rd-muted)] sm:ml-auto"
          >
            {formatReportDate(report.createdAt)}
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
              ? `Perimeter sisi ${report.side}`
              : "Laporan temuan perimeter"}
          </div>
        )}

        {/* Narrative */}
        <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-[var(--rd-text)] sm:text-sm">
          {report.narrative || "Tidak ada narasi tambahan"}
        </p>

        {/* Meta Info Footer */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[var(--rd-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <Images
              size={15}
              className="text-[var(--rd-link)]"
              aria-hidden="true"
            />
            {report.images?.length || 0} Gambar
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin
              size={15}
              className="text-[var(--rd-link)]"
              aria-hidden="true"
            />
            {report.segmentCode && report.side
              ? `Grid ${report.segmentCode} · Sisi ${report.side}`
              : report.segmentCode
              ? `Grid ${report.segmentCode}`
              : report.side
                ? `Sisi ${report.side}`
                : "Segmen belum dipetakan"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <UserRound
              size={15}
              className="text-[var(--rd-link)]"
              aria-hidden="true"
            />
            {report.reporterName || "Petugas"}
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
  emptyMessage?: string;
  className?: string;
}

export function ReportHistoryPanel({
  title = "Riwayat Laporan",
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
  filters = REPORT_STATUS_FILTERS,
  headerAction,
  emptyMessage = "Tidak ada laporan yang sesuai dengan pencarian atau filter.",
  className = "",
}: ReportHistoryPanelProps) {
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

  // Filter & Search Logic
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
      {/* Header title */}
      <div className="flex items-center justify-between pb-3">
        <h2 className="m-0 text-base font-normal text-[var(--rd-text)] sm:text-lg">
          {title}
        </h2>
        {headerAction}
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
          placeholder="Cari berdasarkan jenis bagian, kerusakan, dan lokasi"
          className="w-full rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] py-2.5 pl-10 pr-4 text-xs text-[var(--rd-text)] outline-none transition-colors placeholder:text-[var(--rd-muted)] focus:border-[var(--rd-primary)] focus:ring-2 focus:ring-[var(--rd-active)] sm:text-sm"
          aria-label="Cari laporan"
        />
      </div>

      {/* Status Filter Tabs */}
      <div className="mb-2 flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
        {filters.map(([val, label]) => {
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
          <span>{totalItems} laporan ditemukan</span>
        )}
        <button
          type="button"
          onClick={handleToggleSort}
          title={
            newest
              ? "Urutan terbaru dahulu. Klik untuk terlama"
              : "Urutan terlama dahulu. Klik untuk terbaru"
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
              className="flex w-full items-start gap-3 rounded-2xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-4"
            >
              <Skeleton className="size-11 rounded-xl sm:size-12" />
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-16 rounded" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-3/4 rounded" />
                <div className="flex gap-4 pt-1">
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
              </div>
            </div>
          ))
        ) : currentReports.length > 0 ? (
          currentReports.map((report) => (
            <ReportCardItem
              key={report.id}
              report={report}
              selected={report.id === selectedId}
              onSelect={onSelect}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--rd-border)] p-8 text-center text-xs text-[var(--rd-muted)] sm:text-sm">
            {emptyMessage}
          </div>
        )}
      </div>

      {/* Bottom Pagination */}
      {!loading && totalItems > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-[var(--rd-muted)] sm:text-sm">
          <span>
            Menampilkan {startIndex + 1}–{endIndex} dari {totalItems}
          </span>
          <div className="flex items-center gap-1">
            {/* Prev Button */}
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex size-7 items-center justify-center rounded-md text-[var(--rd-text)] transition-colors hover:bg-[var(--rd-hover)] disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Page items */}
            {paginationRange.map((item, idx) => {
              if (item === "...") {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="flex size-7 items-center justify-center text-xs text-[var(--rd-muted)] select-none"
                  >
                    . .
                  </span>
                );
              }
              const pageNum = Number(item);
              const isCurrent = pageNum === safePage;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`flex size-7 items-center justify-center rounded-full text-xs transition-colors ${
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
              aria-label="Halaman berikutnya"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
