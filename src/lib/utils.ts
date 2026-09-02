import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind class names, resolving any conflicts.
 *
 * @param inputs - An array of class names to merge.
 * @returns A string of merged and optimized class names.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Resolves the Geotab WebSocket URL for this deployment.
 *
 * Order of preference:
 *  1. NEXT_PUBLIC_GEOTAB_WS_URL (explicit override, e.g. wss://yourdomain.com/ws)
 *  2. A same-origin, path-based connection derived from the page host and
 *     protocol, i.e. `wss://<host>/ws` on HTTPS or `ws://<host>/ws` on HTTP.
 *     This lets the WS pass through the front-end reverse proxy (nginx) that
 *     serves the domain instead of trying a raw `:3004` port on the web host.
 *
 * Returns an empty string when not running in a browser.
 */
export function getGeotabWsUrl(): string {
  const override = process.env.NEXT_PUBLIC_GEOTAB_WS_URL;
  if (override && override.trim()) return override.trim();

  if (typeof window === 'undefined') return '';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}
