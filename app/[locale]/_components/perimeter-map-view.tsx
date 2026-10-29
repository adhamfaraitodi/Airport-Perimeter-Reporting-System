"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { PerimeterMapInnerProps } from "./perimeter-map-inner";
import { mapFillClass, mapFrameClass } from "./map-classes";

export { isPointInNavigationBounds, type LatLngPoint } from "./map-bounds";

function MapLoading({ fill }: { fill?: boolean }) {
  return (
    <div
      className={`${fill ? mapFillClass : mapFrameClass} relative overflow-hidden p-3`}
      role="status"
      aria-label="Memuat peta perimeter YIA"
    >
      <Skeleton className="size-full rounded-xl" />
      <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1.5">
        <Skeleton className="size-[34px] rounded-[4px] bg-[var(--rd-surface)]/90" />
        <Skeleton className="size-[34px] rounded-[4px] bg-[var(--rd-surface)]/90" />
      </div>
      <Skeleton className="pointer-events-none absolute top-3 right-3 h-[34px] w-24 rounded-[4px] bg-[var(--rd-surface)]/90" />
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
