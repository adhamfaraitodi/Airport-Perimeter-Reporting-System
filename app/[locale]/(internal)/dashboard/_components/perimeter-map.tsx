"use client";

import MapView from "../../../_components/perimeter-map-view";
import type { ReportRecord } from "../../../_lib/client-api";

export interface PerimeterMapProps {
  reports: ReportRecord[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

export function PerimeterMap({
  reports,
  selectedId,
  onSelect,
}: PerimeterMapProps) {
  return (
    <section className="operator-map">
      <MapView
        reports={reports}
        selectedId={selectedId}
        onSelect={onSelect}
      />
      <div className="map-legend">
        <strong>
          <i className="live-dot" /> Kondisi perimeter
        </strong>
        <span>
          <i className="legend-dot OPEN" /> Baru
        </span>
        <span>
          <i className="legend-dot IN_PROGRESS" /> Ditangani
        </span>
        <span>
          <i className="legend-dot RESOLVED" /> Selesai
        </span>
      </div>
    </section>
  );
}
