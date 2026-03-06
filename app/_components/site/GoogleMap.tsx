"use client";

import { useEffect, useRef } from "react";

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

      // Load script once
      if (!document.getElementById("google-maps-script")) {
        const script = document.createElement("script");
        script.id = "google-maps-script";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&libraries=marker`;
        script.async = true;

        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Google Maps"));
          document.head.appendChild(script);
        });
      }

      if (cancelled || !mapRef.current || !window.google) return;

      const { Map } = (await google.maps.importLibrary("maps")) as google.maps.MapsLibrary;
      const { AdvancedMarkerElement, PinElement } =
        (await google.maps.importLibrary("marker")) as google.maps.MarkerLibrary;

      const center = { lat: 59.9718, lng: 11.0493 };

      const map = new Map(mapRef.current, {
        center,
        zoom: 10,
        mapId: "DEMO_MAP_ID",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        rotateControl: false,
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
          { featureType: "road.local", stylers: [{ visibility: "off" }] },
          { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#d9d9d9" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#aab3d6" }] }
        ]
      });

      const pin = new PinElement({
        background: "#273097",
        borderColor: "#ffffff",
        glyphColor: "#ffffff",
        scale: 1.2
      });

      new AdvancedMarkerElement({
        map,
        position: center,
        title: "Otman Transport",
        content: pin.element
      });
    }

    initMap();

    return () => {
      cancelled = true;
    };
  }, []);

  return <div ref={mapRef} className="w-full h-full" />;
}