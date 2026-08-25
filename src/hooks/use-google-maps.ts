'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google?: typeof google;
    __googleMapsLoaded?: boolean;
    __googleMapsCallbacks?: (() => void)[];
  }
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_TOKEN || '';

export function useGoogleMaps() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!API_KEY) {
      setError('Google Maps API key is not configured');
      return;
    }

    if (typeof window === 'undefined') return;

    if (window.google?.maps) {
      setLoaded(true);
      return;
    }

    if (window.__googleMapsLoaded) {
      setLoaded(true);
      return;
    }

    if (!window.__googleMapsCallbacks) {
      window.__googleMapsCallbacks = [];
    }
    window.__googleMapsCallbacks.push(() => setLoaded(true));

    const existingScript = document.getElementById('google-maps-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=directions&loading=async&callback=__googleMapsInit`;
      script.async = true;
      script.defer = true;
      script.onerror = () => setError('Failed to load Google Maps');
      document.head.appendChild(script);

      (window as any).__googleMapsInit = () => {
        window.__googleMapsLoaded = true;
        window.__googleMapsCallbacks?.forEach((cb) => cb());
        window.__googleMapsCallbacks = [];
      };
    }
  }, []);

  return { loaded, error, apiKey: API_KEY };
}
