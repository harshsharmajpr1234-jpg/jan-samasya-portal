"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMapInstance, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Leaflet + OpenStreetMap picker (100% free — no API key).
 * Click/tap to drop a pin; "readOnly" renders a static viewer.
 */
export interface LeafletMapProps {
  lat: number | null;
  lng: number | null;
  onPick?: (lat: number, lng: number) => void;
  readOnly?: boolean;
  height?: number;
}

const CENTER: [number, number] = [
  Number(process.env.NEXT_PUBLIC_MAP_CENTER_LAT ?? 26.8467),
  Number(process.env.NEXT_PUBLIC_MAP_CENTER_LNG ?? 80.9462),
];
const ZOOM = Number(process.env.NEXT_PUBLIC_MAP_ZOOM ?? 13);

function pinIcon(L: typeof import("leaflet")) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48"><path d="M18 1C8.6 1 1 8.6 1 18c0 12.6 17 29 17 29s17-16.4 17-29C35 8.6 27.4 1 18 1z" fill="#e35d1c" stroke="#0e1830" stroke-width="2"/><circle cx="18" cy="17" r="7" fill="#fdfaf3"/></svg>`;
  return L.divIcon({
    html: `<div class="pin-marker">${svg}</div>`,
    className: "",
    iconSize: [36, 48],
    iconAnchor: [18, 46],
    popupAnchor: [0, -44],
  });
}

export default function LeafletMap({ lat, lng, onPick, readOnly = false, height = 320 }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const initial: [number, number] = lat !== null && lng !== null ? [lat, lng] : CENTER;
      const map = L.map(containerRef.current, {
        center: initial,
        zoom: lat !== null ? 16 : ZOOM,
        scrollWheelZoom: false,
        dragging: !readOnly || true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);

      const icon = pinIcon(L);
      if (lat !== null && lng !== null) {
        markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
      }

      if (!readOnly) {
        map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
          const { lat: la, lng: ln } = e.latlng;
          if (markerRef.current) markerRef.current.setLatLng([la, ln]);
          else markerRef.current = L.marker([la, ln], { icon }).addTo(map);
          onPickRef.current?.(Number(la.toFixed(6)), Number(ln.toFixed(6)));
        });
      } else {
        map.dragging.disable();
        map.doubleClickZoom.disable();
        map.boxZoom.disable();
        map.keyboard.disable();
      }

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  // Keep the marker in sync when coordinates change from outside (geolocation).
  useEffect(() => {
    if (lat === null || lng === null || !mapRef.current) return;
    (async () => {
      const L = await import("leaflet");
      const map = mapRef.current;
      if (!map) return;
      if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
      else markerRef.current = L.marker([lat, lng], { icon: pinIcon(L) }).addTo(map);
      if (!readOnly) map.setView([lat, lng], Math.max(map.getZoom(), 16));
    })();
  }, [lat, lng, readOnly]);

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="w-full overflow-hidden rounded-2xl border border-line shadow-card"
      role="application"
      aria-label={readOnly ? "Map showing complaint location" : "Map — click to mark the problem location"}
    />
  );
}
