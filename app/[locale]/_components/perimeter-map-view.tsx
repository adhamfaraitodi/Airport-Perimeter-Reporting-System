"use client";

import dynamic from "next/dynamic";
import type { PerimeterMapInnerProps } from "./perimeter-map-inner";

export { isPointInNavigationBounds, type LatLngPoint } from "./map-bounds";

const DynamicPerimeterMap = dynamic(() => import("./perimeter-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="map-wrap flex items-center justify-center text-xs text-gray-500">
      Memuat peta perimeter YIA...
    </div>
  ),
});

export default function MapView(props: PerimeterMapInnerProps) {
  return <DynamicPerimeterMap {...props} />;
}
