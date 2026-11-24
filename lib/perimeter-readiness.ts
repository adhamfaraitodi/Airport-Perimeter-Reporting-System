import { latLngToGridFloat } from "../app/[locale]/_components/airport-grid";
import {
  PERIMETER_GRID_BOXES,
  PERIMETER_GRID_CODES,
  PERIMETER_GRID_SET,
  PERIMETER_GRID_TOTAL,
} from "../app/[locale]/_data/perimeter-grids";
import type { ReportRecord } from "../app/[locale]/_lib/client-api";

export interface PerimeterReadinessSummary {
  totalGrids: number;
  damagedGrids: number;
  readyGrids: number;
  readinessPercent: number;
  damagedGridCodes: string[];
  openCount: number;
  awaitingVerificationCount: number;
  resolvedCount: number;
}

export interface CategoryDamageCount {
  partId: string;
  partName: string;
  count: number;
}

export interface CategoryDamageBreakdown {
  totalActiveDamages: number;
  categories: CategoryDamageCount[];
}

const SNAP_THRESHOLD_CELLS = 0.25;

/**
 * Euclidean distance from continuous grid point `(colFloat, rowFloat)`
 * to unit cell box `[colIndex, colIndex + 1] × [rowIndex, rowIndex + 1]`.
 */
function distanceToBox(
  colFloat: number,
  rowFloat: number,
  colIndex: number,
  rowIndex: number
): number {
  const dx = Math.max(colIndex - colFloat, 0, colFloat - (colIndex + 1));
  const dy = Math.max(rowIndex - rowFloat, 0, rowFloat - (rowIndex + 1));
  return Math.hypot(dx, dy);
}

/**
 * Resolves a report to one of the 60 canonical perimeter grid codes, or `null`
 * if neither `segmentCode` nor `(latitude, longitude)` maps within 0.25 cells
 * of a perimeter grid cell.
 */
export function resolvePerimeterGridCode(
  report: Pick<ReportRecord, "segmentCode" | "latitude" | "longitude">
): string | null {
  const normalized = report.segmentCode?.trim().toUpperCase();
  if (normalized && PERIMETER_GRID_SET.has(normalized)) {
    return normalized;
  }

  const { latitude, longitude } = report;
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    const { colFloat, rowFloat } = latLngToGridFloat(latitude, longitude);
    if (Number.isFinite(colFloat) && Number.isFinite(rowFloat)) {
      let nearestCode: string | null = null;
      let minDist = Number.POSITIVE_INFINITY;

      for (const box of PERIMETER_GRID_BOXES) {
        const dist = distanceToBox(colFloat, rowFloat, box.colIndex, box.rowIndex);
        if (dist < minDist) {
          minDist = dist;
          nearestCode = box.code;
        }
      }

      if (nearestCode && minDist <= SNAP_THRESHOLD_CELLS) {
        return nearestCode;
      }
    }
  }

  return null;
}

/**
 * Computes the 60-grid perimeter readiness summary across all reports.
 * - Fixed denominator `PERIMETER_GRID_TOTAL` (60).
 * - Deduplicates active (`OPEN` | `IN_PROGRESS` and not soft-deleted) reports per grid cell.
 * - Counts non-deleted reports by status (`openCount`, `awaitingVerificationCount`, `resolvedCount`).
 */
export function calculatePerimeterReadiness(
  reports: ReadonlyArray<
    Pick<
      ReportRecord,
      "status" | "deletedAt" | "segmentCode" | "latitude" | "longitude"
    >
  >
): PerimeterReadinessSummary {
  const damagedSet = new Set<string>();
  let openCount = 0;
  let awaitingVerificationCount = 0;
  let resolvedCount = 0;

  for (const report of reports) {
    if (report.deletedAt) {
      continue;
    }

    if (report.status === "OPEN") {
      openCount += 1;
    } else if (report.status === "IN_PROGRESS") {
      awaitingVerificationCount += 1;
    } else if (report.status === "RESOLVED") {
      resolvedCount += 1;
    }

    if (report.status === "OPEN" || report.status === "IN_PROGRESS") {
      const gridCode = resolvePerimeterGridCode(report);
      if (gridCode) {
        damagedSet.add(gridCode);
      }
    }
  }

  const damagedGridCodes = PERIMETER_GRID_CODES.filter((code) =>
    damagedSet.has(code)
  );
  const damagedGrids = damagedGridCodes.length;
  const readyGrids = PERIMETER_GRID_TOTAL - damagedGrids;
  const readinessPercent =
    Math.round((readyGrids / PERIMETER_GRID_TOTAL) * 100 * 10) / 10;

  return {
    totalGrids: PERIMETER_GRID_TOTAL,
    damagedGrids,
    readyGrids,
    readinessPercent,
    damagedGridCodes,
    openCount,
    awaitingVerificationCount,
    resolvedCount,
  };
}

/**
 * Counts active damage items (`damages.length`) per impacted perimeter part across
 * active (`OPEN` | `IN_PROGRESS` and not soft-deleted) reports.
 * Returns only categories with active damages (`count > 0`), ordered by count desc then name asc.
 */
export function calculateCategoryDamageBreakdown(
  reports: ReadonlyArray<
    Pick<ReportRecord, "status" | "deletedAt" | "findings">
  >
): CategoryDamageBreakdown {
  const buckets = new Map<string, CategoryDamageCount>();
  const nameToKey = new Map<string, string>();
  let totalActiveDamages = 0;

  for (const report of reports) {
    if (report.deletedAt) continue;
    if (report.status !== "OPEN" && report.status !== "IN_PROGRESS") continue;

    for (const finding of report.findings ?? []) {
      const damageCount = Array.isArray(finding.damages)
        ? finding.damages.length
        : 0;
      if (damageCount === 0) continue;

      const rawPartId = finding.partId?.trim() || "";
      const rawPartName = finding.partName?.trim() || "";
      const normalizedName = rawPartName.toLocaleLowerCase("id");

      const key =
        (rawPartId && buckets.has(rawPartId) ? rawPartId : "") ||
        (normalizedName ? nameToKey.get(normalizedName) || "" : "") ||
        rawPartId ||
        normalizedName;

      if (!key) continue;

      let entry = buckets.get(key);
      if (!entry) {
        entry = {
          partId: rawPartId || key,
          partName: rawPartName || rawPartId,
          count: 0,
        };
        buckets.set(key, entry);
        if (normalizedName) nameToKey.set(normalizedName, key);
      }

      entry.count += damageCount;
      totalActiveDamages += damageCount;
    }
  }

  const categories = Array.from(buckets.values()).sort(
    (a, b) =>
      b.count - a.count || a.partName.localeCompare(b.partName, "id")
  );

  return {
    totalActiveDamages,
    categories,
  };
}
