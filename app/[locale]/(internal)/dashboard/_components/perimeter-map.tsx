"use client";

import MapView from "../../../_components/perimeter-map-view";
import type { ReportRecord } from "../../../_lib/client-api";

export interface PerimeterMapProps {
  reports: ReportRecord[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

const legend = [
  ["OPEN", "Baru"],
  ["IN_PROGRESS", "Ditangani"],
  ["RESOLVED", "Selesai"],
] as const;

export function PerimeterMap({
  reports,
  selectedId,
  onSelect,
}: PerimeterMapProps) {
  return (
    <section className="relative h-[42%] min-h-[210px] min-w-0 shrink-0 overflow-hidden rounded-t-xl border border-solid border-[var(--rd-border)] md:h-full md:min-h-0 md:rounded-[14px]">
      <MapView
        fill
        reports={reports}
        selectedId={selectedId}
        onSelect={onSelect}
      />
      <div className="pointer-events-none absolute inset-x-2.5 bottom-3 z-[500] flex flex-wrap items-center gap-2 rounded-lg border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)]/95 p-2 text-[8px] text-[var(--rd-text)] shadow-[0_2px_12px_rgba(24,56,37,0.04)] md:inset-x-[15px] md:gap-3.5 md:p-3.5 md:text-[9px]">
        <strong className="mr-auto flex items-center gap-1.5 text-[8px] md:text-[10px]">
          <i className="inline-block size-[7px] rounded-full bg-[var(--rd-link)]" />
          Kondisi perimeter
        </strong>
        {legend.map(([status, label]) => (
          <span key={status} className="flex items-center gap-1.5">
            <i
              data-status={status}
              className="rd-status inline-block size-[7px] rounded-full bg-[var(--rd-status)]"
            />
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
