import type { Feature, FeatureCollection, LineString, Polygon } from "geojson";

export const GRID_COLS = 29;
export const GRID_ROWS = 14;
export const ROW_LABELS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
] as const;

/**
 * Calibrated against Appendix 3: Grid Map Bandara Internasional Yogyakarta
 * and the surveyed YIA perimeter polygon (`new_perimeter.json`).
 *
 * - Map rotation is `MAP_BEARING = -20` deg (counter-clockwise).
 * - Grid X axis runs along bearing 110 deg (+20 deg South of East), so it renders
 *   100% horizontal on the rotated map.
 * - Grid Y axis runs along bearing 200 deg (+20 deg West of South), so it renders
 *   100% vertical on the rotated map.
 * - Each grid cell is 200m x 200m.
 * - Reference anchor is the SW perimeter corner (-7.898498, 110.033862), which lies
 *   at column offset c = 0.85 (inside Col 1) and row offset r = 12.75 (inside Row M).
 */
const SW_ANCHOR_LAT = -7.898498;
const SW_ANCHOR_LNG = 110.033862;
const SW_COL_OFFSET = 1.127;
const SW_ROW_OFFSET = 12.36;
const CELL_SIZE_M = 195;

const DEG_TO_RAD = Math.PI / 180;
const GRID_ANGLE_RAD = 20 * DEG_TO_RAD;
const COS_THETA = Math.cos(GRID_ANGLE_RAD);
const SIN_THETA = Math.sin(GRID_ANGLE_RAD);

// Conformal scale at YIA latitude (-7.901 deg) so lines are strictly orthogonal in Web Mercator
const METERS_PER_DEG_LAT = 110574.3;
const METERS_PER_DEG_LNG =
  METERS_PER_DEG_LAT * Math.cos(-7.901 * DEG_TO_RAD);

/**
 * Converts continuous grid coordinates `(col, row)` into `[lat, lng]`.
 * - `col = 0` is the left edge of Column 1; `col = 29` is the right edge of Column 29.
 * - `row = 0` is the top edge of Row A; `row = 14` is the bottom edge of Row N.
 */
export function gridToLatLng(col: number, row: number): [number, number] {
  const xMeters = (col - SW_COL_OFFSET) * CELL_SIZE_M;
  const yNorthMeters = (SW_ROW_OFFSET - row) * CELL_SIZE_M;

  const eastMeters = xMeters * COS_THETA + yNorthMeters * SIN_THETA;
  const northMeters = -xMeters * SIN_THETA + yNorthMeters * COS_THETA;

  const lat = SW_ANCHOR_LAT + northMeters / METERS_PER_DEG_LAT;
  const lng = SW_ANCHOR_LNG + eastMeters / METERS_PER_DEG_LNG;
  return [lat, lng];
}

/**
 * Converts `[lat, lng]` into `[lng, lat]` for GeoJSON coordinates.
 */
function gridToGeoJsonCoord(col: number, row: number): [number, number] {
  const [lat, lng] = gridToLatLng(col, row);
  return [lng, lat];
}

/**
 * Inverse projection: given a geographic `(lat, lng)` point, returns the
 * 1-based column (`1..29`), row label (`A..N`), and combined code (e.g. `"K14"`),
 * or `null` if the point lies outside the 29x14 grid.
 */
export function getGridCellFromLatLng(
  lat: number,
  lng: number
): { col: number; row: string; code: string } | null {
  const northMeters = (lat - SW_ANCHOR_LAT) * METERS_PER_DEG_LAT;
  const eastMeters = (lng - SW_ANCHOR_LNG) * METERS_PER_DEG_LNG;

  const xMeters = eastMeters * COS_THETA - northMeters * SIN_THETA;
  const yNorthMeters = eastMeters * SIN_THETA + northMeters * COS_THETA;

  const colFloat = xMeters / CELL_SIZE_M + SW_COL_OFFSET;
  const rowFloat = SW_ROW_OFFSET - yNorthMeters / CELL_SIZE_M;

  const colIndex = Math.floor(colFloat);
  const rowIndex = Math.floor(rowFloat);

  if (
    colIndex < 0 ||
    colIndex >= GRID_COLS ||
    rowIndex < 0 ||
    rowIndex >= GRID_ROWS
  ) {
    return null;
  }

  const col = colIndex + 1;
  const row = ROW_LABELS[rowIndex];
  return { col, row, code: `${row}${col}` };
}

export interface GridLabelItem {
  id: string;
  text: string;
  position: [number, number];
}

const HEADER_THICKNESS = 0.62;

/**
 * Generates the GeoJSON lines for the 29x14 internal grid, the surrounding
 * header frame polygons (white label cells + 4 black corner blocks), and the
 * label center coordinates for `1..29` and `A..N`.
 */
export function buildAirportGridData() {
  const lineFeatures: Feature<LineString>[] = [];
  const headerCellFeatures: Feature<Polygon>[] = [];
  const cornerFeatures: Feature<Polygon>[] = [];
  const labels: GridLabelItem[] = [];

  // 1. Vertical internal grid lines (c = 0 .. 29)
  for (let c = 0; c <= GRID_COLS; c++) {
    lineFeatures.push({
      type: "Feature",
      properties: { kind: "grid-line", axis: "col", index: c },
      geometry: {
        type: "LineString",
        coordinates: [
          gridToGeoJsonCoord(c, 0),
          gridToGeoJsonCoord(c, GRID_ROWS),
        ],
      },
    });
  }

  // 2. Horizontal internal grid lines (r = 0 .. 14)
  for (let r = 0; r <= GRID_ROWS; r++) {
    lineFeatures.push({
      type: "Feature",
      properties: { kind: "grid-line", axis: "row", index: r },
      geometry: {
        type: "LineString",
        coordinates: [
          gridToGeoJsonCoord(0, r),
          gridToGeoJsonCoord(GRID_COLS, r),
        ],
      },
    });
  }

  const makeBoxPolygon = (
    c0: number,
    r0: number,
    c1: number,
    r1: number,
    props: Record<string, unknown> = {}
  ): Feature<Polygon> => ({
    type: "Feature",
    properties: props,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          gridToGeoJsonCoord(c0, r0),
          gridToGeoJsonCoord(c1, r0),
          gridToGeoJsonCoord(c1, r1),
          gridToGeoJsonCoord(c0, r1),
          gridToGeoJsonCoord(c0, r0),
        ],
      ],
    },
  });

  // 3. Top & Bottom column header cells (1 .. 29)
  for (let c = 0; c < GRID_COLS; c++) {
    const text = String(c + 1);
    // Top bar
    headerCellFeatures.push(
      makeBoxPolygon(c, -HEADER_THICKNESS, c + 1, 0, {
        kind: "header-cell",
        side: "top",
        label: text,
      })
    );
    labels.push({
      id: `top-${text}`,
      text,
      position: gridToLatLng(c + 0.5, -HEADER_THICKNESS / 2),
    });

    // Bottom bar
    headerCellFeatures.push(
      makeBoxPolygon(c, GRID_ROWS, c + 1, GRID_ROWS + HEADER_THICKNESS, {
        kind: "header-cell",
        side: "bottom",
        label: text,
      })
    );
    labels.push({
      id: `bottom-${text}`,
      text,
      position: gridToLatLng(c + 0.5, GRID_ROWS + HEADER_THICKNESS / 2),
    });
  }

  // 4. Left & Right row header cells (A .. N)
  for (let r = 0; r < GRID_ROWS; r++) {
    const text = ROW_LABELS[r];
    // Left bar
    headerCellFeatures.push(
      makeBoxPolygon(-HEADER_THICKNESS, r, 0, r + 1, {
        kind: "header-cell",
        side: "left",
        label: text,
      })
    );
    labels.push({
      id: `left-${text}`,
      text,
      position: gridToLatLng(-HEADER_THICKNESS / 2, r + 0.5),
    });

    // Right bar
    headerCellFeatures.push(
      makeBoxPolygon(GRID_COLS, r, GRID_COLS + HEADER_THICKNESS, r + 1, {
        kind: "header-cell",
        side: "right",
        label: text,
      })
    );
    labels.push({
      id: `right-${text}`,
      text,
      position: gridToLatLng(GRID_COLS + HEADER_THICKNESS / 2, r + 0.5),
    });
  }

  // 5. Four black corner blocks matching Appendix 3
  cornerFeatures.push(
    makeBoxPolygon(-HEADER_THICKNESS, -HEADER_THICKNESS, 0, 0, {
      kind: "corner",
    }),
    makeBoxPolygon(
      GRID_COLS,
      -HEADER_THICKNESS,
      GRID_COLS + HEADER_THICKNESS,
      0,
      { kind: "corner" }
    ),
    makeBoxPolygon(
      -HEADER_THICKNESS,
      GRID_ROWS,
      0,
      GRID_ROWS + HEADER_THICKNESS,
      { kind: "corner" }
    ),
    makeBoxPolygon(
      GRID_COLS,
      GRID_ROWS,
      GRID_COLS + HEADER_THICKNESS,
      GRID_ROWS + HEADER_THICKNESS,
      { kind: "corner" }
    )
  );

  const linesCollection: FeatureCollection<LineString> = {
    type: "FeatureCollection",
    features: lineFeatures,
  };

  const headerCellsCollection: FeatureCollection<Polygon> = {
    type: "FeatureCollection",
    features: headerCellFeatures,
  };

  const cornersCollection: FeatureCollection<Polygon> = {
    type: "FeatureCollection",
    features: cornerFeatures,
  };

  // Full outer corners of the grid including header frame
  const outerCorners: [number, number][] = [
    gridToLatLng(-HEADER_THICKNESS, -HEADER_THICKNESS),
    gridToLatLng(GRID_COLS + HEADER_THICKNESS, -HEADER_THICKNESS),
    gridToLatLng(GRID_COLS + HEADER_THICKNESS, GRID_ROWS + HEADER_THICKNESS),
    gridToLatLng(-HEADER_THICKNESS, GRID_ROWS + HEADER_THICKNESS),
  ];

  return {
    linesCollection,
    headerCellsCollection,
    cornersCollection,
    labels,
    outerCorners,
  };
}
