import perimeter from "../_data/new_perimeter.json";

export interface LatLngPoint {
  latitude: number;
  longitude: number;
}

// Destination on a sphere, not a viewport-relative padding ratio.
export function destination(
  lat: number,
  lng: number,
  bearing: number,
  meters = 2000
): [number, number] {
  const rad = Math.PI / 180;
  const d = meters / 6371008.8;
  const p = lat * rad;
  const b = bearing * rad;
  const p2 = Math.asin(
    Math.sin(p) * Math.cos(d) + Math.cos(p) * Math.sin(d) * Math.cos(b)
  );
  return [
    p2 / rad,
    lng +
      Math.atan2(
        Math.sin(b) * Math.sin(d) * Math.cos(p),
        Math.cos(d) - Math.sin(p) * Math.sin(p2)
      ) /
        rad,
  ];
}

function computeRawPerimeterBox() {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  const visit = (coords: unknown): void => {
    if (!Array.isArray(coords)) return;
    if (
      coords.length >= 2 &&
      typeof coords[0] === "number" &&
      typeof coords[1] === "number"
    ) {
      const lng = coords[0];
      const lat = coords[1];
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      return;
    }
    for (const item of coords) {
      visit(item);
    }
  };

  for (const feature of perimeter.features || []) {
    visit(feature.geometry?.coordinates);
  }

  return { sw: { lat: minLat, lng: minLng }, ne: { lat: maxLat, lng: maxLng } };
}

const rawBox = computeRawPerimeterBox();

const navSouth = destination(rawBox.sw.lat, rawBox.sw.lng, 180)[0];
const navWest = Math.min(
  destination(rawBox.sw.lat, rawBox.sw.lng, 270)[1],
  destination(rawBox.ne.lat, rawBox.sw.lng, 270)[1]
);
const navNorth = destination(rawBox.ne.lat, rawBox.ne.lng, 0)[0];
const navEast = Math.max(
  destination(rawBox.sw.lat, rawBox.ne.lng, 90)[1],
  destination(rawBox.ne.lat, rawBox.ne.lng, 90)[1]
);

export const NAVIGATION_BOUNDS_BOX = {
  southWest: [navSouth, navWest] as [number, number],
  northEast: [navNorth, navEast] as [number, number],
};

export const isPointInNavigationBounds = (
  point?: LatLngPoint | null
): boolean =>
  !!point &&
  Number.isFinite(point.latitude) &&
  Number.isFinite(point.longitude) &&
  point.latitude >= navSouth &&
  point.latitude <= navNorth &&
  point.longitude >= navWest &&
  point.longitude <= navEast;
