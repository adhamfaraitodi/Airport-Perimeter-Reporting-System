"use client";

import type {
  CategoryDamageBreakdown,
  PerimeterReadinessSummary,
} from "@/lib/perimeter-readiness";
import { useTranslation } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { focusRing } from "../../../_lib/ui-classes";

export interface PerimeterReadinessCardProps {
  summary: PerimeterReadinessSummary;
  categoryBreakdown?: CategoryDamageBreakdown;
  loading?: boolean;
  activeSearch?: string;
  onSelectGrid?: (gridCode: string) => void;
}

const MAX_VISIBLE_CHIPS = 8;

const bentoTileClass =
  "rounded-[14px] border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:px-5";

export function PerimeterReadinessCard({
  summary,
  categoryBreakdown = { totalActiveDamages: 0, categories: [] },
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
  const impactedCategories = categoryBreakdown.categories.filter(
    (category) => category.count > 0
  );

  return (
    <section
      aria-label={r.title}
      aria-busy={loading}
      className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-12"
    >
      {loading ? (
        <>
          {/* Tile 1 skeleton: Readiness bar & status counters (8 cols) */}
          <article className={`${bentoTileClass} lg:col-span-8`}>
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-36 rounded-md" />
                <Skeleton className="h-7 w-20 rounded-md" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-36 rounded-lg" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            </div>
          </article>

          {/* Tile 2 skeleton: Impacted grids (4 cols) */}
          <article
            className={`${bentoTileClass} flex flex-col justify-between gap-2.5 lg:col-span-4`}
          >
            <Skeleton className="h-4 w-32 rounded-md" />
            <div className="flex flex-wrap items-center gap-1.5">
              <Skeleton className="h-8 w-12 rounded-md" />
              <Skeleton className="h-8 w-12 rounded-md" />
              <Skeleton className="h-8 w-12 rounded-md" />
            </div>
          </article>

          {/* Tile 3 skeleton: Impacted damage categories (12 cols) */}
          <article className={`${bentoTileClass} py-3 lg:col-span-12`}>
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-4">
              <div className="flex shrink-0 items-baseline justify-between gap-2 lg:w-44 lg:flex-col lg:border-r lg:border-solid lg:border-[var(--rd-border)] lg:pr-4">
                <Skeleton className="h-4 w-36 rounded-md" />
                <Skeleton className="h-6 w-24 rounded-md" />
              </div>
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(156px,1fr))]">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-[52px] w-full rounded-xl" />
                ))}
              </div>
            </div>
          </article>
        </>
      ) : (
        <>
          {/* Tile 1 (8 cols): Primary readiness score, progress bar, and status counters */}
          <article
            className={`${bentoTileClass} flex min-w-0 flex-col justify-between gap-2.5 lg:col-span-8`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 sm:justify-start">
              <h2 className="text-sm font-semibold text-[var(--rd-text)] sm:text-base">
                {r.title}
              </h2>
              <div className="flex items-baseline gap-2.5">
                <span
                  className="text-2xl leading-none font-extrabold tracking-tight tabular-nums sm:text-[26px]"
                  style={{ color: thresholdColor }}
                >
                  {formattedPercent}
                </span>
                <span className="text-xs font-semibold text-[var(--rd-muted)]">
                  ({readyCountsLabel} &bull; {damagedCountsLabel})
                </span>
              </div>
            </div>

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

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
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
                <span className="text-sm font-bold tabular-nums text-[var(--rd-text)]">
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
                <span className="text-sm font-bold tabular-nums text-[var(--rd-text)]">
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
                <span className="text-sm font-bold tabular-nums text-[var(--rd-text)]">
                  {summary.resolvedCount}
                </span>
              </div>
            </div>
          </article>

          {/* Tile 2 (4 cols): Impacted Grid Chips or All Clear message */}
          <article
            className={`${bentoTileClass} flex min-w-0 flex-col justify-between gap-2.5 lg:col-span-4`}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--rd-text)]">
                {r.impactedGridsLabel}
              </h3>
              <span className="text-xs font-bold tabular-nums text-[var(--rd-muted)]">
                {summary.damagedGridCodes.length}/{summary.totalGrids}
              </span>
            </div>

            {summary.damagedGridCodes.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {visibleChips.map((code) => {
                  const isSelected = normalizedActiveSearch === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => onSelectGrid?.(code)}
                      aria-pressed={isSelected}
                      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-solid px-2.5 py-1 text-xs font-bold transition-colors sm:min-h-[32px] sm:min-w-0 ${focusRing} ${
                        isSelected
                          ? "border-[var(--rd-primary)] bg-[var(--rd-active)] text-[var(--rd-text)] ring-1 ring-[var(--rd-primary)]"
                          : "border-[var(--rd-issue)]/35 bg-[var(--rd-issue)]/8 text-[var(--rd-issue)] hover:border-[var(--rd-issue)]/70 hover:bg-[var(--rd-issue)]/12 active:bg-[var(--rd-issue)]/12"
                      }`}
                    >
                      {code}
                    </button>
                  );
                })}
                {overflowCount > 0 && (
                  <span className="inline-flex items-center rounded-md border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] px-2 py-1 text-xs font-semibold text-[var(--rd-muted)]">
                    +{overflowCount} {r.moreCount}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-1 items-center">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--rd-lime)]">
                  <span
                    className="size-2 shrink-0 rounded-full bg-[var(--rd-lime)]"
                    aria-hidden="true"
                  />
                  {r.allClear}
                </span>
              </div>
            )}
          </article>

          {/* Tile 3 (12 cols): Static breakdown of impacted damage categories only */}
          <article className={`${bentoTileClass} py-3 lg:col-span-12`}>
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-4">
              <div className="flex shrink-0 items-baseline justify-between gap-3 lg:w-48 lg:flex-col lg:justify-center lg:gap-0.5 lg:border-r lg:border-solid lg:border-[var(--rd-border)] lg:pr-4">
                <h3 className="text-sm font-semibold text-[var(--rd-text)]">
                  {r.categoryTitle}
                </h3>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl leading-tight font-extrabold tabular-nums text-[var(--rd-text)]">
                    {categoryBreakdown.totalActiveDamages}
                  </span>
                  <span className="text-xs font-medium text-[var(--rd-muted)]">
                    {r.activeDamagesUnit}
                  </span>
                </div>
              </div>

              {impactedCategories.length > 0 ? (
                <ul className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(156px,1fr))]">
                  {impactedCategories.map((category) => (
                    <li
                      key={category.partId}
                      className="flex min-w-0 flex-col justify-between gap-1 rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] px-3 py-2"
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="text-lg leading-none font-extrabold tabular-nums text-[var(--rd-text)]">
                          {category.count}
                        </span>
                        <span
                          className="size-2 shrink-0 rounded-full bg-[var(--rd-issue)]"
                          aria-hidden="true"
                        />
                      </div>
                      <span className="block w-full text-xs leading-tight font-semibold break-words text-[var(--rd-text)]">
                        {category.partName}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-1 items-center">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--rd-lime)]">
                    <span
                      className="size-2 shrink-0 rounded-full bg-[var(--rd-lime)]"
                      aria-hidden="true"
                    />
                    {r.noCategoryData}
                  </span>
                </div>
              )}
            </div>
          </article>
        </>
      )}
    </section>
  );
}
