"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet-rotate";
import perimeter from "../_data/new_perimeter.json";
import { labels } from "../_lib/draft-store";
import type { ReportRecord } from "../_lib/client-api";
import {
  buildAirportGridData,
  getGridCellFromLatLng,
} from "./airport-grid";
import {
  isPointInNavigationBounds,
  NAVIGATION_BOUNDS_BOX,
  type LatLngPoint,
} from "./map-bounds";
import { mapFillClass, mapFrameClass } from "./map-classes";

export interface PerimeterMapInnerProps {
  reports?: ReportRecord[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  point?: LatLngPoint | null;
  onPoint?: (point: LatLngPoint) => void;
  editable?: boolean;
  /** Stretch to the parent's height without its own frame (border/radius). */
  fill?: boolean;
  className?: string;
}

const MAP_BEARING = -20;

const geometry = L.geoJSON(perimeter as GeoJSON.GeoJsonObject);
const perimeterBounds = geometry.getBounds();
const gridData = buildAirportGridData();
const navigationBounds = L.latLngBounds(
  NAVIGATION_BOUNDS_BOX.southWest,
  NAVIGATION_BOUNDS_BOX.northEast
);

const pinClass =
  "rd-status grid size-[30px] -rotate-45 place-items-center rounded-[50%_50%_50%_5px] border-[3px] border-solid border-white bg-[var(--rd-status)] text-[16px] font-bold text-white shadow-[0_2px_8px_rgba(41,74,56,0.38)]";
const pinSelectedClass =
  "outline-3 outline-offset-3 outline-solid outline-[var(--rd-text)]";

const icon = (status: string, selected = false) => {
  const safeStatus = ["OPEN", "IN_PROGRESS", "RESOLVED"].includes(status)
    ? status
    : "LOCATION";
  const symbol =
    safeStatus === "RESOLVED"
      ? "✓"
      : safeStatus === "IN_PROGRESS"
        ? "…"
        : safeStatus === "LOCATION"
          ? "•"
          : "!";
  return L.divIcon({
    className: "",
    html: `<span data-status="${safeStatus}" class="${pinClass} ${
      selected ? pinSelectedClass : ""
    }"><span class="rotate-45 leading-none">${symbol}</span></span>`,
    iconSize: [32, 38],
    iconAnchor: [16, 35],
  });
};

const gridHeaderLabelIcon = (text: string) =>
  L.divIcon({
    className: "",
    html: `<span class="flex size-full items-center justify-center text-[10px] font-bold leading-none text-gray-900 select-none sm:text-[11px]">${text}</span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

export default function PerimeterMapInner({
  reports = [],
  selectedId,
  onSelect,
  point,
  onPoint,
  editable = false,
  fill = false,
  className = "",
}: PerimeterMapInnerProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const callbacks = useRef({ onPoint, onSelect });
  const [tileError, setTileError] = useState(false);
  const pointOutsideBounds = point && !isPointInNavigationBounds(point);
  callbacks.current = { onPoint, onSelect };

  useEffect(() => {
    if (!host.current) return;
    const mapOptions = {
      center: perimeterBounds.getCenter(),
      zoom: 14,
      rotate: true,
      bearing: MAP_BEARING,
      rotateControl: false,
      touchRotate: false,
      shiftKeyRotate: false,
      maxBounds: navigationBounds,
      maxBoundsViscosity: 1,
      maxZoom: 18,
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: false,
    } as unknown as L.MapOptions;
    const instance = L.map(host.current, mapOptions);
    map.current = instance;

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      maxNativeZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    })
      .on("tileerror", () => setTileError(true))
      .addTo(instance);

    // 1. Perimeter polygon
    L.geoJSON(perimeter as GeoJSON.GeoJsonObject, {
      interactive: false,
      style: {
        color: "#167b68",
        weight: 3,
        fillColor: "#32a88c",
        fillOpacity: 0.08,
      },
    }).addTo(instance);

    // 2. Rotated 29x14 Grid lines (counter-angled +20 deg so they appear straight on -20 deg map)
    L.geoJSON(gridData.linesCollection as GeoJSON.GeoJsonObject, {
      interactive: false,
      style: {
        color: "#ca8a04",
        weight: 1,
        opacity: 0.75,
      },
    }).addTo(instance);

    // 3. Outer header cells (1..29 top/bottom, A..N left/right)
    L.geoJSON(gridData.headerCellsCollection as GeoJSON.GeoJsonObject, {
      interactive: false,
      style: {
        color: "#1f2937",
        weight: 1.2,
        fillColor: "#ffffff",
        fillOpacity: 0.94,
      },
    }).addTo(instance);

    // 4. Four black corner blocks matching Appendix 3
    L.geoJSON(gridData.cornersCollection as GeoJSON.GeoJsonObject, {
      interactive: false,
      style: {
        color: "#111827",
        weight: 1.2,
        fillColor: "#111827",
        fillOpacity: 0.98,
      },
    }).addTo(instance);

    // 5. Header labels (1..29 & A..N)
    gridData.labels.forEach((item) => {
      L.marker(item.position, {
        interactive: false,
        keyboard: false,
        icon: gridHeaderLabelIcon(item.text),
      }).addTo(instance);
    });

    layer.current = L.layerGroup().addTo(instance);
    let initialized = false;

    const resize = () => {
      instance.invalidateSize();
      instance.setMinZoom(
        Math.min(18, instance.getBoundsZoom(navigationBounds, true))
      );
      if (!initialized) {
        instance.fitBounds(perimeterBounds, { padding: [24, 24], maxZoom: 16 });
        initialized = true;
      } else {
        instance.panInsideBounds(navigationBounds, { animate: false });
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host.current);

    if (editable) {
      instance.on("click", (event: L.LeafletMouseEvent) =>
        callbacks.current.onPoint?.({
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
        })
      );
    }

    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
  }, [editable]);

  useEffect(() => {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();

    reports
      .filter(
        (r) =>
          !r.deletedAt &&
          Number.isFinite(r.latitude) &&
          Number.isFinite(r.longitude)
      )
      .forEach((report) => {
        const cell = getGridCellFromLatLng(report.latitude, report.longitude);
        const gridSuffix = cell ? ` · Grid ${cell.code}` : "";
        L.marker([report.latitude, report.longitude], {
          icon: icon(report.status, report.id === selectedId),
          title: `${labels[report.status] || report.status} · ${
            report.side || "Lokasi laporan"
          }${gridSuffix}`,
        })
          .on("click", () => callbacks.current.onSelect?.(report.id))
          .addTo(layer.current!);
      });

    if (point && isPointInNavigationBounds(point)) {
      const cell = getGridCellFromLatLng(point.latitude, point.longitude);
      const marker = L.marker([point.latitude, point.longitude], {
        icon: icon("LOCATION", true),
        draggable: editable,
        title: editable
          ? `Geser pin lokasi laporan${cell ? ` (Grid ${cell.code})` : ""}`
          : `Lokasi laporan${cell ? ` (Grid ${cell.code})` : ""}`,
      }).addTo(layer.current);

      marker.on("dragend", () => {
        const p = marker.getLatLng();
        callbacks.current.onPoint?.({ latitude: p.lat, longitude: p.lng });
      });
      map.current.panTo([point.latitude, point.longitude]);
    } else if (point) {
      map.current.fitBounds(perimeterBounds, {
        padding: [24, 24],
        maxZoom: 16,
      });
    }
  }, [reports, selectedId, point, editable]);

  return (
    <div className={`${fill ? mapFillClass : mapFrameClass} ${className}`}>
      <div
        className="h-full w-full"
        ref={host}
        aria-label="Peta perimeter YIA"
      />
      <button
        type="button"
        className="absolute top-3 right-3 z-[500] inline-flex min-h-[34px] items-center gap-1 rounded-[4px] border-2 border-black/20 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#333333] shadow-none transition-colors hover:bg-[#f4f4f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)]"
        onClick={() =>
          map.current?.fitBounds(perimeterBounds, {
            padding: [24, 24],
            maxZoom: 16,
          })
        }
      >
        ⌖ Perimeter
      </button>
      {(tileError || pointOutsideBounds) && (
        <div
          className="absolute top-16 right-2.5 left-[55px] z-[500] rounded-md bg-[var(--rd-surface)] p-2.5 text-[11px] text-[var(--rd-coral)] shadow-sm"
          role="status"
        >
          {tileError && <div>Peta dasar gagal dimuat. Periksa koneksi.</div>}
          {pointOutsideBounds && (
            <div>
              Lokasi berada di luar jangkauan peta; pin tidak ditampilkan.
              Koordinat asli tidak diubah.
              {editable
                ? " Ketuk peta untuk memilih lokasi kejadian secara manual."
                : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
