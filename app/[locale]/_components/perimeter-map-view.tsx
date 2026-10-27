"use client";

import dynamic from "next/dynamic";
import type { PerimeterMapInnerProps } from "./perimeter-map-inner";
import { mapFillClass, mapFrameClass } from "./map-classes";

export { isPointInNavigationBounds, type LatLngPoint } from "./map-bounds";

function MapLoading({ fill }: { fill?: boolean }) {
  return (
    <div
      className={`${fill ? mapFillClass : mapFrameClass} flex items-center justify-center text-xs text-[var(--rd-muted)]`}
    >
      Memuat peta perimeter YIA…
    </div>
  );
}

const DynamicPerimeterMap = dynamic(() => import("./perimeter-map-inner"), {
  ssr: false,
  loading: () => <MapLoading />,
});

export default function MapView(props: PerimeterMapInnerProps) {
  return <DynamicPerimeterMap {...props} />;
}
