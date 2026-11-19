import assert from "node:assert/strict";
import { gridToLatLng } from "../app/[locale]/_components/airport-grid";
import {
  PERIMETER_GRID_CODES,
  PERIMETER_GRID_SET,
  PERIMETER_GRID_TOTAL,
} from "../app/[locale]/_data/perimeter-grids";
import {
  calculatePerimeterReadiness,
  resolvePerimeterGridCode,
} from "./perimeter-readiness";

// 1. PERIMETER_GRID_TOTAL === 60 and PERIMETER_GRID_SET.size === 60 (no duplicates)
assert.equal(PERIMETER_GRID_TOTAL, 60, "PERIMETER_GRID_TOTAL must be 60");
assert.equal(PERIMETER_GRID_CODES.length, 60, "PERIMETER_GRID_CODES must have 60 entries");
assert.equal(PERIMETER_GRID_SET.size, 60, "PERIMETER_GRID_SET must contain 60 unique codes");

// 2. Empty reports array
{
  const summary = calculatePerimeterReadiness([]);
  assert.equal(summary.totalGrids, 60);
  assert.equal(summary.damagedGrids, 0);
  assert.equal(summary.readyGrids, 60);
  assert.equal(summary.readinessPercent, 100);
  assert.deepEqual(summary.damagedGridCodes, []);
  assert.equal(summary.openCount, 0);
  assert.equal(summary.awaitingVerificationCount, 0);
  assert.equal(summary.resolvedCount, 0);
}

// 3. Deduplication: 3 active reports (OPEN, IN_PROGRESS, OPEN) all in M11
{
  const [lat, lng] = gridToLatLng(10.5, 12.5); // M11 center
  const summary = calculatePerimeterReadiness([
    { status: "OPEN", deletedAt: null, segmentCode: "M11", latitude: lat, longitude: lng },
    { status: "IN_PROGRESS", deletedAt: null, segmentCode: "M11", latitude: lat, longitude: lng },
    { status: "OPEN", deletedAt: null, segmentCode: "m11", latitude: lat, longitude: lng },
  ]);
  assert.equal(summary.damagedGrids, 1);
  assert.equal(summary.readyGrids, 59);
  assert.equal(summary.readinessPercent, 98.3);
  assert.deepEqual(summary.damagedGridCodes, ["M11"]);
  assert.equal(summary.openCount, 2);
  assert.equal(summary.awaitingVerificationCount, 1);
  assert.equal(summary.resolvedCount, 0);
}

// 4. 6 distinct damaged grids (J2, I10, M11, M15, K28, L2) -> damagedGrids === 6, readyGrids === 54, readinessPercent === 90
{
  const codes = ["L2", "M15", "J2", "K28", "I10", "M11"];
  const reports = codes.map((code, idx) => ({
    status: (idx % 2 === 0 ? "OPEN" : "IN_PROGRESS") as "OPEN" | "IN_PROGRESS",
    deletedAt: null,
    segmentCode: code,
    latitude: -7.9,
    longitude: 110.05,
  }));
  const summary = calculatePerimeterReadiness(reports);
  assert.equal(summary.damagedGrids, 6);
  assert.equal(summary.readyGrids, 54);
  assert.equal(summary.readinessPercent, 90);
  // Ordered by PERIMETER_GRID_CODES order: J2, I10, K28, M15, M11, L2
  assert.deepEqual(summary.damagedGridCodes, ["J2", "I10", "K28", "M15", "M11", "L2"]);
}

// 5. RESOLVED reports and soft-deleted (deletedAt !== null) reports do NOT reduce readiness
{
  const summary = calculatePerimeterReadiness([
    {
      status: "RESOLVED",
      deletedAt: null,
      segmentCode: "M11",
      latitude: -7.9,
      longitude: 110.05,
    },
    {
      status: "OPEN",
      deletedAt: "2026-11-19T10:00:00.000Z",
      segmentCode: "J2",
      latitude: -7.9,
      longitude: 110.05,
    },
    {
      status: "IN_PROGRESS",
      deletedAt: "2026-11-19T11:00:00.000Z",
      segmentCode: "I15",
      latitude: -7.9,
      longitude: 110.05,
    },
  ]);
  assert.equal(summary.damagedGrids, 0);
  assert.equal(summary.readyGrids, 60);
  assert.equal(summary.readinessPercent, 100);
  assert.deepEqual(summary.damagedGridCodes, []);
  assert.equal(summary.openCount, 0);
  assert.equal(summary.awaitingVerificationCount, 0);
  assert.equal(summary.resolvedCount, 1);
}

// 6. South-edge coordinate snapping: [lat, lng] = gridToLatLng(14.5, 13.04) (inside N15, 0.04 cells south of M15) with segmentCode: "N15"
{
  const [lat, lng] = gridToLatLng(14.5, 13.04);
  const resolved = resolvePerimeterGridCode({
    segmentCode: "N15",
    latitude: lat,
    longitude: lng,
  });
  assert.equal(resolved, "M15");

  const summary = calculatePerimeterReadiness([
    {
      status: "OPEN",
      deletedAt: null,
      segmentCode: "N15",
      latitude: lat,
      longitude: lng,
    },
  ]);
  assert.equal(summary.damagedGrids, 1);
  assert.deepEqual(summary.damagedGridCodes, ["M15"]);
}

// 7. Far interior report (segmentCode: "K10" with [lat, lng] = gridToLatLng(9.5, 10.5)) and invalid coords (NaN, NaN, no segmentCode) both resolve to null and do not throw or change readiness
{
  const [interiorLat, interiorLng] = gridToLatLng(9.5, 10.5);
  assert.equal(
    resolvePerimeterGridCode({
      segmentCode: "K10",
      latitude: interiorLat,
      longitude: interiorLng,
    }),
    null
  );
  assert.equal(
    resolvePerimeterGridCode({
      segmentCode: undefined,
      latitude: Number.NaN,
      longitude: Number.NaN,
    }),
    null
  );

  const summary = calculatePerimeterReadiness([
    {
      status: "OPEN",
      deletedAt: null,
      segmentCode: "K10",
      latitude: interiorLat,
      longitude: interiorLng,
    },
    {
      status: "IN_PROGRESS",
      deletedAt: null,
      segmentCode: undefined,
      latitude: Number.NaN,
      longitude: Number.NaN,
    },
  ]);
  assert.equal(summary.damagedGrids, 0);
  assert.equal(summary.readyGrids, 60);
  assert.equal(summary.readinessPercent, 100);
  assert.deepEqual(summary.damagedGridCodes, []);
  assert.equal(summary.openCount, 1);
  assert.equal(summary.awaitingVerificationCount, 1);
}

console.log("PASS: lib/perimeter-readiness.test.ts (all 7 test suites passed)");
