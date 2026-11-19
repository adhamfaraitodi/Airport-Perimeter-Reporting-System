import assert from "node:assert/strict";
import { PERIMETER_GRID_CODES } from "../app/[locale]/_data/perimeter-grids";
import { getPerimeterPolylinesForGrids } from "./perimeter-segments";

// 1. Every single grid code in PERIMETER_GRID_CODES (all 60/60) returns >= 1 polyline
//    with latLngs.length >= 2 and finite lat in [-8.0, -7.8] and lng in [110.0, 110.1]
{
  let coveredBlocks = 0;
  for (const code of PERIMETER_GRID_CODES) {
    const polylines = getPerimeterPolylinesForGrids([code]);
    assert.ok(
      polylines.length >= 1,
      `Expected >= 1 polyline for perimeter grid ${code}, got ${polylines.length}`
    );
    for (const poly of polylines) {
      assert.equal(poly.gridCode, code);
      assert.ok(
        poly.latLngs.length >= 2,
        `Expected >= 2 latLng points for ${code}, got ${poly.latLngs.length}`
      );
      for (const [lat, lng] of poly.latLngs) {
        assert.ok(Number.isFinite(lat), `lat must be finite for ${code}`);
        assert.ok(Number.isFinite(lng), `lng must be finite for ${code}`);
        assert.ok(
          lat >= -8.0 && lat <= -7.8,
          `lat ${lat} out of expected YIA bounds [-8.0, -7.8] for ${code}`
        );
        assert.ok(
          lng >= 110.0 && lng <= 110.1,
          `lng ${lng} out of expected YIA bounds [110.0, 110.1] for ${code}`
        );
      }
    }
    coveredBlocks += 1;
  }
  assert.equal(coveredBlocks, 60, "All 60/60 perimeter grid blocks must be covered");
}

// 2. getPerimeterPolylinesForGrids(["M11"]) returns non-empty polylines whose gridCode === "M11"
{
  const m11 = getPerimeterPolylinesForGrids(["M11"]);
  assert.ok(m11.length > 0, "Expected non-empty polylines for M11");
  for (const seg of m11) {
    assert.equal(seg.gridCode, "M11");
  }
}

// 3. getPerimeterPolylinesForGrids([]) returns []
{
  assert.deepEqual(getPerimeterPolylinesForGrids([]), []);
}

// 4. getPerimeterPolylinesForGrids(["INVALID", "A1", "m11"]) ignores unknown codes and normalizes "m11" -> "M11"
{
  const m11Canonical = getPerimeterPolylinesForGrids(["M11"]);
  const mixed = getPerimeterPolylinesForGrids(["INVALID", "A1", "  m11  "]);
  assert.equal(mixed.length, m11Canonical.length);
  assert.deepEqual(mixed, m11Canonical);
}

// 5. Deduplication: getPerimeterPolylinesForGrids(["M11", "M11"]) returns the same count as ["M11"]
{
  const single = getPerimeterPolylinesForGrids(["M11"]);
  const duplicate = getPerimeterPolylinesForGrids(["M11", "M11", "m11"]);
  assert.equal(duplicate.length, single.length);
  assert.deepEqual(duplicate, single);
}

console.log("PASS: lib/perimeter-segments.test.ts (all 5 test suites & 60/60 perimeter blocks passed)");
