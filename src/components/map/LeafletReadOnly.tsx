"use client";

import dynamic from "next/dynamic";

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div className="h-[260px] w-full animate-pulse rounded-2xl bg-paper-2" />,
});

/** Server-safe wrapper for rendering a read-only map inside server components. */
export default function LeafletReadOnly({ lat, lng }: { lat: number; lng: number }) {
  return <LeafletMap lat={lat} lng={lng} readOnly height={260} />;
}
