"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import perimeter from "../_data/new_perimeter.json";
import { labels } from "../_lib/draft-store";
import type { ReportRecord } from "../_lib/client-api";
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

const geometry = L.geoJSON(perimeter as GeoJSON.GeoJsonObject);
const perimeterBounds = geometry.getBounds();
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
    const instance = L.map(host.current, {
      center: perimeterBounds.getCenter(),
      zoom: 14,
      maxBounds: navigationBounds,
      maxBoundsViscosity: 1,
      maxZoom: 18,
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: false,
    });
    map.current = instance;

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      maxNativeZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    })
      .on("tileerror", () => setTileError(true))
      .addTo(instance);

    L.geoJSON(perimeter as GeoJSON.GeoJsonObject, {
      style: {
        color: "#167b68",
        weight: 3,
        fillColor: "#32a88c",
        fillOpacity: 0.08,
      },
    }).addTo(instance);

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
        L.marker([report.latitude, report.longitude], {
          icon: icon(report.status, report.id === selectedId),
          title: `${labels[report.status] || report.status} · ${report.side || "Lokasi laporan"}`,
        })
          .on("click", () => callbacks.current.onSelect?.(report.id))
          .addTo(layer.current!);
      });

    if (point && isPointInNavigationBounds(point)) {
      const marker = L.marker([point.latitude, point.longitude], {
        icon: icon("LOCATION", true),
        draggable: editable,
        title: editable ? "Geser pin lokasi laporan" : "Lokasi laporan",
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
        className="absolute top-3 right-3 z-[500] inline-flex min-h-[38px] items-center gap-1 rounded-lg bg-[var(--rd-surface)] px-3 py-2 text-[11px] font-semibold text-[var(--rd-link)] shadow-[0_2px_8px_rgba(23,63,37,0.09)] transition-colors hover:bg-[var(--rd-active)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)]"
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
