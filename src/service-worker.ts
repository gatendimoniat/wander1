import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { clientsClaim } from 'workbox-core';

declare let self: ServiceWorkerGlobalScope;

// Precache static assets
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// App shell fallback
const handler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(handler);
registerRoute(navigationRoute);

// Cache map tiles (OSM)
registerRoute(
  ({ url }) => url.hostname.includes('tile.openstreetmap.org'),
  new CacheFirst({
    cacheName: 'osm-tiles',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 5000,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
  'GET'
);

// Cache Esri satellite tiles
registerRoute(
  ({ url }) => url.hostname.includes('server.arcgisonline.com'),
  new CacheFirst({
    cacheName: 'esri-tiles',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 5000,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
  'GET'
);

// Cache OpenTopoMap tiles
registerRoute(
  ({ url }) => url.hostname.includes('tile.opentopomap.org'),
  new CacheFirst({
    cacheName: 'topo-tiles',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 5000,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
  'GET'
);

// Cache Nominatim search results
registerRoute(
  ({ url }) => url.hostname.includes('nominatim.openstreetmap.org'),
  new NetworkFirst({
    cacheName: 'nominatim-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24,
      }),
    ],
  }),
  'GET'
);

// Cache Wikipedia API
registerRoute(
  ({ url }) => url.hostname.includes('wikipedia.org'),
  new NetworkFirst({
    cacheName: 'wikipedia-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24,
      }),
    ],
  }),
  'GET'
);

// Cache Overpass API
registerRoute(
  ({ url }) => url.hostname.includes('overpass-api.de') || url.hostname.includes('overpass.kumi.systems'),
  new NetworkFirst({
    cacheName: 'overpass-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 6,
      }),
    ],
  }),
  'GET'
);

// Cache OSRM routing
registerRoute(
  ({ url }) => url.hostname.includes('router.project-osrm.org'),
  new NetworkFirst({
    cacheName: 'osrm-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 2,
      }),
    ],
  }),
  'GET'
);

// Cache static assets (CSS, JS, images)
registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font',
  new StaleWhileRevalidate({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 7,
      }),
    ],
  }),
  'GET'
);

// Cache Supabase API responses for offline access to routes/tracks
registerRoute(
  ({ url }) => url.hostname.includes('supabase.co'),
  new NetworkFirst({
    cacheName: 'supabase-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24,
      }),
    ],
  }),
  'GET'
);

// Claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(clientsClaim());
});

// Handle offline fallback
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
  }
});
