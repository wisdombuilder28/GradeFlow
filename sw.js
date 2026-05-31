/**
 * sw.js — GradeFlow Service Worker
 *
 * Strategy:
 *  - App Shell (HTML, CSS, JS, fonts): Cache-first, fallback to network.
 *  - Navigation requests: Network-first, fallback to cached shell.
 *  - Everything else: Network-first, cache as fallback.
 *
 * Versioning: bump CACHE_VERSION on every deploy so Vercel's
 * immutable CDN URLs + the service worker update cycle both work.
 *
 * Auto-update: the SW activates immediately (skipWaiting) and
 * claims all tabs (clients.claim) so users always get the latest
 * version on the next page load after a deploy.
 */

const CACHE_VERSION  = 'gradeflow-v3';
const CACHE_DYNAMIC  = 'gradeflow-dynamic-v3';

// ─── APP SHELL — pre-cached on install ────────────────────────
// These are the minimum files needed to render the app offline.
const APP_SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/js/app.js',
  '/js/state.js',
  '/js/storage.js',
  '/js/subjects.js',
  '/js/analytics.js',
  '/js/chart.js',
  '/js/ui.js',
  '/js/theme.js',
  '/js/helpers.js',
  '/js/dataIO.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Google Fonts — cached on first load, served offline after
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap'
];

// ═══════════════════════════════════════════════════════════════
//  INSTALL — Pre-cache the app shell
// ═══════════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(APP_SHELL);
    }).then(() => {
      // Activate immediately — don't wait for old tabs to close
      return self.skipWaiting();
    })
  );
});

// ═══════════════════════════════════════════════════════════════
//  ACTIVATE — Clean up old caches
// ═══════════════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION && key !== CACHE_DYNAMIC)
          .map((key) => {
            console.log(`[SW] Deleting old cache: ${key}`);
            return caches.delete(key);
          })
      )
    ).then(() => {
      // Take control of all open tabs immediately
      return self.clients.claim();
    })
  );
});

// ═══════════════════════════════════════════════════════════════
//  FETCH — Routing strategy
// ═══════════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and browser-extension requests
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // ── 1. Navigation (HTML pages) → Network-first ──────────────
  if (request.mode === 'navigate') {
    event.respondWith(_networkFirst(request, CACHE_VERSION));
    return;
  }

  // ── 2. App Shell assets → Cache-first ───────────────────────
  if (_isAppShell(url)) {
    event.respondWith(_cacheFirst(request, CACHE_VERSION));
    return;
  }

  // ── 3. Google Fonts (CSS + woff2) → Cache-first ─────────────
  if (url.hostname.includes('fonts.g')) {
    event.respondWith(_cacheFirst(request, CACHE_DYNAMIC));
    return;
  }

  // ── 4. Everything else → Network-first, dynamic cache ───────
  event.respondWith(_networkFirst(request, CACHE_DYNAMIC));
});

// ═══════════════════════════════════════════════════════════════
//  STRATEGIES
// ═══════════════════════════════════════════════════════════════

/**
 * Cache-first: serve from cache immediately, fall back to network.
 * Best for versioned/immutable assets.
 */
async function _cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return _offlineFallback(request);
  }
}

/**
 * Network-first: try network, fall back to cache.
 * Best for navigations and frequently-updated resources.
 */
async function _networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || _offlineFallback(request);
  }
}

/**
 * Offline fallback — return the cached index.html shell
 * so the app loads even with zero connectivity.
 */
async function _offlineFallback(request) {
  if (request.mode === 'navigate') {
    const cached = await caches.match('/index.html');
    if (cached) return cached;
  }
  // Generic offline response for non-nav requests
  return new Response('Offline — resource not available', {
    status: 503,
    headers: { 'Content-Type': 'text/plain' }
  });
}

/**
 * Check if a URL matches one of our pre-cached app shell files.
 */
function _isAppShell(url) {
  const shellPaths = [
    '/index.html', '/style.css', '/manifest.json',
    '/js/app.js', '/js/state.js', '/js/storage.js',
    '/js/subjects.js', '/js/analytics.js', '/js/chart.js',
    '/js/ui.js', '/js/theme.js', '/js/helpers.js', '/js/dataIO.js'
  ];
  return shellPaths.some((p) => url.pathname === p || url.pathname === p.replace('/index.html', '/'));
}

// ═══════════════════════════════════════════════════════════════
//  BACKGROUND SYNC — ready for future use (Phase 2+ features)
// ═══════════════════════════════════════════════════════════════
self.addEventListener('sync', (event) => {
  if (event.tag === 'gradeflow-sync') {
    console.log('[SW] Background sync triggered — placeholder for future cloud sync.');
  }
});

// ═══════════════════════════════════════════════════════════════
//  MESSAGE CHANNEL — allow app to trigger SW updates
// ═══════════════════════════════════════════════════════════════
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: CACHE_VERSION });
  }
});
