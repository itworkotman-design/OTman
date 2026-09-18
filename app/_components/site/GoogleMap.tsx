"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    __googleMapsInitCallback?: () => void;
  }
}

// Module-level singleton: with `loading=async`, google.maps.importLibrary
// only exists once the API calls back via the `callback` URL param — not
// when the script's `load` event fires — so readiness is tracked via a
// shared promise rather than by sniffing the script tag/window.google.
let mapsLoadPromise: Promise<void> | null = null;

function isGoogleMapsReady(): boolean {
  // Cast locally to an optional shape: the ambient @types/google.maps
  // declaration types `window.google` as always defined, which makes
  // TS flag a direct existence check as a no-op.
  const w = window as unknown as { google?: typeof google };
  return typeof w.google?.maps?.importLibrary === "function";
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (isGoogleMapsReady()) return Promise.resolve();
  if (mapsLoadPromise) return mapsLoadPromise;

  mapsLoadPromise = new Promise<void>((resolve, reject) => {
    window.__googleMapsInitCallback = resolve;

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&libraries=marker&loading=async&callback=__googleMapsInitCallback`;
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });

  return mapsLoadPromise;
}

export default function GoogleMap() {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!mapRef.current) return;

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
      if (!apiKey) {
        console.error("Missing NEXT_PUBLIC_GOOGLE_MAPS_KEY");
        return;
      }

      await loadGoogleMaps(apiKey);

      if (cancelled || !mapRef.current) return;

      const { Map } = (await google.maps.importLibrary("maps")) as google.maps.MapsLibrary;
      const { AdvancedMarkerElement, PinElement } =
        (await google.maps.importLibrary("marker")) as google.maps.MarkerLibrary;

      if (cancelled || !mapRef.current) return;

      const center = { lat: 60.0039, lng: 11.0405 };

      const map = new Map(mapRef.current, {
        center,
        zoom: 10,
        mapId: "DEMO_MAP_ID",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        rotateControl: false,
      });

      const pin = new PinElement({
        background: "#273097",
        borderColor: "#ffffff",
        glyphColor: "#ffffff",
        scale: 1.2,
      });

      new AdvancedMarkerElement({
        map,
        position: center,
        title: "Otman AS",
        content: pin,
      });
    }

    initMap();

    return () => {
      cancelled = true;
    };
  }, []);

  return <div ref={mapRef} className="w-full h-full" />;
}