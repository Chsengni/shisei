/// <reference lib="webworker" />
/* Service worker (served as /sw.js next to the pages, so its scope is the whole site, language folders included).
   Images are the site's weight: about 60 KB a file, and a reader flipping angles and formats fetches dozens. They are
   kept CacheFirst with a cap (2,000 files, 30 days) instead of being precached: the library is tens of thousands of
   files and nobody needs all of them. Hashed scripts and styles under assets/ never change, so they are cache-first
   too. Pages are not cached here: they carry the catalog and must stay current. */
import { cacheNames, clientsClaim, setCacheNameDetails } from 'workbox-core';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

setCacheNameDetails({ prefix: 'shisei' });
self.skipWaiting();
clientsClaim();

const IMAGE_CACHE = 'shisei-images-v1';
const ASSET_CACHE = 'shisei-assets-v1';
const KEEP = new Set([IMAGE_CACHE, ASSET_CACHE]);

// Every tier of every format, on this site or on the image host (--media, e.g. a CDN mirror of the repo): the path
// is the same everywhere (…/images/<kind>/…/w300|w600|w900/<file>.webp).
const isImage = (url: URL) => /\/images\/.+\.webp$/.test(url.pathname);

registerRoute(
  ({ url, request }) => isImage(url) && (request.method === 'GET'),
  new CacheFirst({
    cacheName: IMAGE_CACHE,
    plugins: [
      // Cross-origin images arrive as no-cors <img> requests whose opaque responses Chrome pads to ~7 MB each in
      // the quota. Asking the image host in cors mode instead (it allows any origin) keeps entries at their real size.
      {
        requestWillFetch: async ({ request }) =>
          new URL(request.url).origin === self.location.origin || request.mode === 'cors'
            ? request
            : new Request(request.url, { mode: 'cors', credentials: 'omit' })
      },
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 2000, maxAgeSeconds: 30 * 24 * 3600, purgeOnQuotaError: true })
    ]
  })
);

registerRoute(
  ({ url, request }) => url.origin === self.location.origin && request.method === 'GET' && /\/assets\/[^/]+\.(?:js|css|woff2)$/.test(url.pathname),
  new CacheFirst({
    cacheName: ASSET_CACHE,
    plugins: [new CacheableResponsePlugin({ statuses: [200] }), new ExpirationPlugin({ maxEntries: 80, purgeOnQuotaError: true })]
  })
);

// A cors refetch the host refuses (or any network failure) falls back to the plain request, uncached.
setCatchHandler(async ({ request }) => {
  try { return await fetch(request); } catch { return Response.error(); }
});

// Drop caches from older versions of this worker (a renamed cache is how a format change gets flushed).
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names
    .filter((n) => n.startsWith('shisei-') && !KEEP.has(n) && n !== cacheNames.runtime)
    .map((n) => caches.delete(n)))));
});
