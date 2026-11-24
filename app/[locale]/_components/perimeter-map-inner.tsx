"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet-rotate";
import { Grid2x2, LocateFixed } from "lucide-react";
import { calculatePerimeterReadiness } from "@/lib/perimeter-readiness";
import { getPerimeterPolylinesForGrids } from "@/lib/perimeter-segments";
import perimeter from "../_data/latest_perimeter.json";
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
  damagedGridCodes?: string[];
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

// Geometry mirrored from public/iconPin.svg (path bounds 43.75 x 87.5 centered at x=50)
const ICON_PIN_PATH =
  "M53.125 49.7734V90.625C53.125 91.4538 52.7958 92.2487 52.2097 92.8347C51.6237 93.4208 50.8288 93.75 50 93.75C49.1712 93.75 48.3764 93.4208 47.7903 92.8347C47.2043 92.2487 46.875 91.4538 46.875 90.625V49.7734C41.4013 48.9834 36.43 46.1493 32.9616 41.8417C29.4932 37.534 27.7852 32.0725 28.1812 26.5563C28.5772 21.04 31.048 15.8786 35.0962 12.1106C39.1444 8.34258 44.4696 6.2478 50 6.2478C55.5305 6.2478 60.8557 8.34258 64.9039 12.1106C68.9521 15.8786 71.4228 21.04 71.8189 26.5563C72.2149 32.0725 70.5069 37.534 67.0385 41.8417C63.5701 46.1493 58.5988 48.9834 53.125 49.7734Z";

const icon = (status: string, selected = false) => {
  const safeStatus = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(
    status
  )
    ? status
    : "LOCATION";
  return L.divIcon({
    className: "",
    html: `<svg data-status="${safeStatus}" viewBox="18 -4 64 108" width="20" height="34" fill="none" aria-hidden="true" class="rd-status block overflow-visible" style="filter:drop-shadow(0 2px 4px rgba(41,74,56,0.38))">${
      selected
        ? `<path d="${ICON_PIN_PATH}" fill="none" stroke-width="16" stroke-linejoin="round" stroke-linecap="round" style="stroke:var(--rd-text)"/>`
        : ""
    }<path d="${ICON_PIN_PATH}" stroke="#ffffff" stroke-width="9" stroke-linejoin="round" style="fill:var(--rd-status);paint-order:stroke fill"/></svg>`,
    iconSize: [20, 34],
    iconAnchor: [10, 31],
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
  damagedGridCodes,
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
  const damageOverlayLayer = useRef<L.LayerGroup | null>(null);
  const gridLayer = useRef<L.LayerGroup | null>(null);
  const callbacks = useRef({ onPoint, onSelect });
  const [tileError, setTileError] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const pointOutsideBounds = point && !isPointInNavigationBounds(point);

  useEffect(() => {
    callbacks.current = { onPoint, onSelect };
  });

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

    // 1b. Damaged perimeter segments translucent red overlay layer
    damageOverlayLayer.current = L.layerGroup().addTo(instance);

    // 2. Toggleable Airport Grid LayerGroup (off by default)
    const gridGroup = L.layerGroup();

    L.geoJSON(gridData.linesCollection as GeoJSON.GeoJsonObject, {
      interactive: false,
      style: {
        color: "#ca8a04",
        weight: 1,
        opacity: 0.75,
      },
    }).addTo(gridGroup);

    L.geoJSON(gridData.headerCellsCollection as GeoJSON.GeoJsonObject, {
      interactive: false,
      style: {
        color: "#1f2937",
        weight: 1.2,
        fillColor: "#ffffff",
        fillOpacity: 0.94,
      },
    }).addTo(gridGroup);

    L.geoJSON(gridData.cornersCollection as GeoJSON.GeoJsonObject, {
      interactive: false,
      style: {
        color: "#111827",
        weight: 1.2,
        fillColor: "#111827",
        fillOpacity: 0.98,
      },
    }).addTo(gridGroup);

    gridData.labels.forEach((item) => {
      L.marker(item.position, {
        interactive: false,
        keyboard: false,
        icon: gridHeaderLabelIcon(item.text),
      }).addTo(gridGroup);
    });

    gridLayer.current = gridGroup;

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
      damageOverlayLayer.current = null;
      gridLayer.current = null;
    };
  }, [editable]);

  useEffect(() => {
    if (!map.current || !gridLayer.current) return;
    if (showGrid) {
      if (!map.current.hasLayer(gridLayer.current)) {
        gridLayer.current.addTo(map.current);
      }
    } else {
      gridLayer.current.remove();
    }
  }, [showGrid]);

  useEffect(() => {
    if (!map.current || !damageOverlayLayer.current) return;
    damageOverlayLayer.current.clearLayers();

    const activeDamagedGrids =
      damagedGridCodes ??
      (reports.length > 0
        ? calculatePerimeterReadiness(reports).damagedGridCodes
        : []);

    for (const seg of getPerimeterPolylinesForGrids(activeDamagedGrids)) {
      L.polyline(seg.latLngs, {
        color: "#ef4444",
        weight: 10,
        opacity: 0.38,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      }).addTo(damageOverlayLayer.current);

      L.polyline(seg.latLngs, {
        color: "#dc2626",
        weight: 4,
        opacity: 0.72,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      }).addTo(damageOverlayLayer.current);
    }
  }, [damagedGridCodes, reports]);

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
      {/* Toggle Grid button directly beneath the Leaflet zoom (+/-) control */}
      <button
        type="button"
        aria-pressed={showGrid}
        title={showGrid ? "Sembunyikan grid" : "Tampilkan grid"}
        aria-label={showGrid ? "Sembunyikan grid" : "Tampilkan grid"}
        className={`absolute top-[82px] left-[10px] z-[500] grid size-[34px] place-items-center rounded-[4px] border-2 border-black/20 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)] ${
          showGrid
            ? "bg-white text-[#333333] hover:bg-[#f4f4f4]"
            : "bg-[#f4f4f4] text-[#bbbbbb] hover:bg-[#eaeaea]"
        }`}
        onClick={() => setShowGrid((prev) => !prev)}
      >
        <Grid2x2 size={16} strokeWidth={2} aria-hidden="true" />
      </button>
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
        <LocateFixed className="w-5 h-5" aria-hidden="true" /> Perimeter
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
