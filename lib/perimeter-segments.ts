import { latLngToGridFloat } from "../app/[locale]/_components/airport-grid";
import perimeter from "../app/[locale]/_data/latest_perimeter.json";
import {
  PERIMETER_GRID_BOXES,
  PERIMETER_GRID_SET,
} from "../app/[locale]/_data/perimeter-grids";

export interface PerimeterSegmentPolyline {
  gridCode: string;
  latLngs: [number, number][];
}

const MICRO_STEP_CELLS = 0.04;

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

function findNearestPerimeterGridCode(
  colFloat: number,
  rowFloat: number
): string {
  let nearestCode = PERIMETER_GRID_BOXES[0].code;
  let minDist = Number.POSITIVE_INFINITY;

  for (const box of PERIMETER_GRID_BOXES) {
    const dist = distanceToBox(colFloat, rowFloat, box.colIndex, box.rowIndex);
    if (dist < minDist) {
      minDist = dist;
      nearestCode = box.code;
    }
  }

  return nearestCode;
}

interface MicroSegmentRun {
  gridCode: string;
  latLngs: [number, number][];
}

function buildPerimeterSegmentMap(): ReadonlyMap<string, [number, number][][]> {
  const ring = perimeter.features[0]?.geometry?.coordinates?.[0];

  const segmentMap = new Map<string, [number, number][][]>();
  if (!ring || ring.length < 2) {
    return segmentMap;
  }

  const runs: MicroSegmentRun[] = [];

  for (let i = 0; i < ring.length - 1; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[i + 1];

    const { colFloat: c1, rowFloat: r1 } = latLngToGridFloat(lat1, lng1);
    const { colFloat: c2, rowFloat: r2 } = latLngToGridFloat(lat2, lng2);

    const gridDist = Math.hypot(c2 - c1, r2 - r1);
    const steps = Math.max(1, Math.ceil(gridDist / MICRO_STEP_CELLS));

    for (let k = 0; k < steps; k++) {
      const t0 = k / steps;
      const t1 = (k + 1) / steps;
      const tMid = (t0 + t1) / 2;

      const midCol = c1 + (c2 - c1) * tMid;
      const midRow = r1 + (r2 - r1) * tMid;
      const gridCode = findNearestPerimeterGridCode(midCol, midRow);

      const startPoint: [number, number] = [
        lat1 + (lat2 - lat1) * t0,
        lng1 + (lng2 - lng1) * t0,
      ];
      const endPoint: [number, number] = [
        lat1 + (lat2 - lat1) * t1,
        lng1 + (lng2 - lng1) * t1,
      ];

      const lastRun = runs[runs.length - 1];
      if (lastRun && lastRun.gridCode === gridCode) {
        lastRun.latLngs.push(endPoint);
      } else {
        runs.push({
          gridCode,
          latLngs: [startPoint, endPoint],
        });
      }
    }
  }

  // Stitch wrap-around seam if first and last run share the same gridCode
  if (runs.length > 1 && runs[0].gridCode === runs[runs.length - 1].gridCode) {
    const first = runs[0];
    const last = runs.pop()!;
    first.latLngs = [...last.latLngs, ...first.latLngs.slice(1)];
  }

  for (const run of runs) {
    const existing = segmentMap.get(run.gridCode);
    if (existing) {
      existing.push(run.latLngs);
    } else {
      segmentMap.set(run.gridCode, [run.latLngs]);
    }
  }

  return segmentMap;
}

const CACHED_PERIMETER_SEGMENTS = buildPerimeterSegmentMap();

/**
 * Returns `[lat, lng][]` polylines along the surveyed YIA perimeter polygon
 * (`latest_perimeter.json`) for the given damaged perimeter grid codes.
 * Unknown or duplicate grid codes are safely ignored/deduplicated.
 */
export function getPerimeterPolylinesForGrids(
  gridCodes: Iterable<string>
): PerimeterSegmentPolyline[] {
  const seen = new Set<string>();
  const result: PerimeterSegmentPolyline[] = [];

  for (const rawCode of gridCodes) {
    if (typeof rawCode !== "string") continue;
    const code = rawCode.trim().toUpperCase();
    if (!code || !PERIMETER_GRID_SET.has(code) || seen.has(code)) {
      continue;
    }
    seen.add(code);

    const polylines = CACHED_PERIMETER_SEGMENTS.get(code);
    if (!polylines) continue;

    for (const latLngs of polylines) {
      result.push({
        gridCode: code,
        latLngs,
      });
    }
  }

  return result;
}
