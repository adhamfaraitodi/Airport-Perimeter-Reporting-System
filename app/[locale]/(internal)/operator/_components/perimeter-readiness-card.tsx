"use client";

import type { PerimeterReadinessSummary } from "@/lib/perimeter-readiness";
import { useTranslation } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { focusRing } from "../../../_lib/ui-classes";

export interface PerimeterReadinessCardProps {
  summary: PerimeterReadinessSummary;
  loading?: boolean;
  activeSearch?: string;
  onSelectGrid?: (gridCode: string) => void;
}

const MAX_VISIBLE_CHIPS = 8;

export function PerimeterReadinessCard({
  summary,
  loading = false,
  activeSearch = "",
  onSelectGrid,
}: PerimeterReadinessCardProps) {
  const { t, isEn } = useTranslation();
  const r = t.operator.readiness;

  const formattedPercent = `${summary.readinessPercent.toLocaleString(
    isEn ? "en-US" : "id-ID",
    {
      minimumFractionDigits: Number.isInteger(summary.readinessPercent) ? 0 : 1,
      maximumFractionDigits: 1,
    }
  )}%`;

  const thresholdColor =
    summary.readinessPercent >= 95
      ? "var(--rd-lime)"
      : summary.readinessPercent >= 80
        ? "var(--rd-brown)"
        : "var(--rd-issue)";

  const readyCountsLabel = isEn
    ? `${summary.readyGrids}/${summary.totalGrids} ${r.readyGrids.toLowerCase()}`
    : `${summary.readyGrids}/${summary.totalGrids} grid siap`;

  const damagedCountsLabel = isEn
    ? `${summary.damagedGrids}/${summary.totalGrids} ${r.damagedGrids.toLowerCase()}`
    : `${summary.damagedGrids}/${summary.totalGrids} grid rusak`;

  const visibleChips = summary.damagedGridCodes.slice(0, MAX_VISIBLE_CHIPS);
  const overflowCount = Math.max(
    0,
    summary.damagedGridCodes.length - MAX_VISIBLE_CHIPS
  );
  const normalizedActiveSearch = activeSearch.trim().toUpperCase();

  return (
    <section
      aria-label={r.title}
      aria-busy={loading}
      className="mb-3 rounded-[14px] border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:px-5"
    >
      {loading ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-36 rounded-md" />
              <Skeleton className="h-7 w-20 rounded-md" />
            </div>
            <Skeleton className="h-2.5 w-full max-w-md rounded-full" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-3.5 w-28 rounded-md" />
              <Skeleton className="h-3.5 w-28 rounded-md" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-36 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
          {/* Parameter Kesiapan */}
          {/* Left: Readiness score, threshold bar, and 60-grid denominator breakdown */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 sm:justify-start">
              <h2 className="text-xs font-bold tracking-[0.8px] text-[var(--rd-muted)] uppercase">
                {r.title}
              </h2>
              <div className="flex items-baseline gap-2.5">
                <span
                  className="text-2xl leading-none font-extrabold tracking-tight sm:text-[26px]"
                  style={{ color: thresholdColor }}
                >
                  {formattedPercent}
                </span>
                <span className="text-xs font-semibold text-[var(--rd-muted)]">
                  ({readyCountsLabel} &bull; {damagedCountsLabel})
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div
              role="progressbar"
              aria-label={r.title}
              aria-valuenow={summary.readinessPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 w-full overflow-hidden rounded-full bg-[var(--rd-border)]/75"
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(0, Math.min(100, summary.readinessPercent))}%`,
                  backgroundColor: thresholdColor,
                }}
              />
            </div>

            {/* Impacted Grid Chips or All Clear message */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {summary.damagedGridCodes.length > 0 ? (
                <>
                  <span className="mr-1 text-xs font-semibold text-[var(--rd-muted)]">
                    {r.impactedGridsLabel}:
                  </span>
                  {visibleChips.map((code) => {
                    const isSelected = normalizedActiveSearch === code;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => onSelectGrid?.(code)}
                        aria-pressed={isSelected}
                        className={`inline-flex items-center rounded-md border border-solid px-2 py-0.5 text-xs font-bold transition-colors ${focusRing} ${
                          isSelected
                            ? "border-[var(--rd-coral)] bg-[var(--rd-coral)] text-white"
                            : "border-[var(--rd-coral)]/35 bg-[var(--rd-coral)]/10 text-[var(--rd-coral)] hover:bg-[var(--rd-coral)]/20"
                        }`}
                      >
                        {code}
                      </button>
                    );
                  })}
                  {overflowCount > 0 && (
                    <span className="inline-flex items-center rounded-md border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--rd-muted)]">
                      +{overflowCount} {r.moreCount}
                    </span>
                  )}
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--rd-lime)]">
                  <span
                    className="size-2 rounded-full bg-[var(--rd-lime)]"
                    aria-hidden="true"
                  />
                  {r.allClear}
                </span>
              )}
            </div>
          </div>

          {/* Right: Compact status counters */}
          <div className="flex flex-wrap items-center gap-2 border-t border-solid border-[var(--rd-border)] pt-2.5 lg:shrink-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4">
            <div
              data-status="OPEN"
              className="rd-status inline-flex items-center gap-2 rounded-lg border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] px-3 py-1.5"
            >
              <span
                className="size-2 rounded-full bg-[var(--rd-status)]"
                aria-hidden="true"
              />
              <span className="text-xs font-medium text-[var(--rd-muted)]">
                {r.openLabel}
              </span>
              <span className="text-sm font-bold text-[var(--rd-text)]">
                {summary.openCount}
              </span>
            </div>

            <div
              data-status="IN_PROGRESS"
              className="rd-status inline-flex items-center gap-2 rounded-lg border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] px-3 py-1.5"
            >
              <span
                className="size-2 rounded-full bg-[var(--rd-status)]"
                aria-hidden="true"
              />
              <span className="text-xs font-medium text-[var(--rd-muted)]">
                {r.awaitingVerificationLabel}
              </span>
              <span className="text-sm font-bold text-[var(--rd-text)]">
                {summary.awaitingVerificationCount}
              </span>
            </div>

            <div
              data-status="RESOLVED"
              className="rd-status inline-flex items-center gap-2 rounded-lg border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] px-3 py-1.5"
            >
              <span
                className="size-2 rounded-full bg-[var(--rd-status)]"
                aria-hidden="true"
              />
              <span className="text-xs font-medium text-[var(--rd-muted)]">
                {r.resolvedLabel}
              </span>
              <span className="text-sm font-bold text-[var(--rd-text)]">
                {summary.resolvedCount}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
