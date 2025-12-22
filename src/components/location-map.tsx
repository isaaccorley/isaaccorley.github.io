"use client";

import { useEffect, useRef } from "react";

interface LocationMapProps {
  lat: number;
  lon: number;
  className?: string;
}

/**
 * LocationMap component displays a Google Maps satellite view
 * of the provided GPS coordinates.
 *
 * Note: This component uses Google Maps iframe embed (no API key required)
 * For production use with high traffic, consider using the Maps JavaScript API.
 */
export function LocationMap({ lat, lon, className = "" }: LocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    // Clear any existing content
    container.innerHTML = "";

    // Create iframe for Google Maps
    const iframe = document.createElement("iframe");
    iframe.width = "100%";
    iframe.height = "100%";
    iframe.style.border = "0";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";

    // Use Google Maps embed with satellite view
    // Direct link format (doesn't require API key)
    const fallbackUrl = `https://maps.google.com/maps?q=${lat},${lon}&t=k&z=14&output=embed`;

    iframe.src = fallbackUrl;
    iframe.title = `Map showing location at ${lat.toFixed(6)}, ${lon.toFixed(6)}`;

    container.appendChild(iframe);

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [lat, lon]);

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full" />
      {/* Overlay to hide Google Maps UI elements */}
      <div className="absolute top-0 left-0 w-full h-10 bg-transparent pointer-events-none" />
    </div>
  );
}
