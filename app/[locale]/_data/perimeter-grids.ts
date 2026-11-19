import { ROW_LABELS } from "../_components/airport-grid";

/**
 * Exact 60 perimeter grid cells traversed by the surveyed YIA perimeter fence
 * (`new_perimeter.json`), ordered clockwise along the perimeter boundary.
 */
export const PERIMETER_GRID_CODES = [
  "J2",
  "J3",
  "J4",
  "J5",
  "J6",
  "J7",
  "I7",
  "I8",
  "I9",
  "I10",
  "I11",
  "I12",
  "I13",
  "I14",
  "I15",
  "I16",
  "I17",
  "I18",
  "I19",
  "I20",
  "I21",
  "I22",
  "J22",
  "J23",
  "J24",
  "K24",
  "K25",
  "K26",
  "K27",
  "K28",
  "L28",
  "M28",
  "M27",
  "M26",
  "M25",
  "M24",
  "M23",
  "M22",
  "M21",
  "M20",
  "M19",
  "M18",
  "M17",
  "M16",
  "M15",
  "M14",
  "M13",
  "M12",
  "M11",
  "M10",
  "M9",
  "M8",
  "M7",
  "M6",
  "M5",
  "M4",
  "M3",
  "M2",
  "L2",
  "K2",
] as const;

export type PerimeterGridCode = (typeof PERIMETER_GRID_CODES)[number];

export const PERIMETER_GRID_TOTAL = PERIMETER_GRID_CODES.length;

export const PERIMETER_GRID_SET: ReadonlySet<string> = new Set<string>(
  PERIMETER_GRID_CODES
);

export const PERIMETER_GRID_BOXES: ReadonlyArray<{
  code: string;
  colIndex: number;
  rowIndex: number;
}> = PERIMETER_GRID_CODES.map((code) => ({
  code,
  colIndex: Number(code.slice(1)) - 1,
  rowIndex: ROW_LABELS.indexOf(code[0] as (typeof ROW_LABELS)[number]),
}));
