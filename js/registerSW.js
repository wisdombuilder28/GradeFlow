/**
 * js/registerSW.js — Service Worker registration + update notifications.
 *
 * Imported by app.js. Handles:
 *  - Registration with a ready console log
 *  - Detecting when a new SW is waiting (new deploy available)
 *  - Showing the update toast banner to the user
 *  - Forcing the new SW to activate when the user clicks "Update"
 */

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.info('[SW] Service Workers not supported in this browser.');
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.info('[SW] Registered. Scope:', registration.scope);

      // ── Detect new SW waiting (= new version deployed) ──────
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          // A new SW installed AND there's already an active SW
          // → a new version is available for the user
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            _showUpdateBanner(newWorker);
          }
        });
      });

      // ── Reload after SW takes control (post-skipWaiting) ────
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

    } catch (err) {
      console.error('[SW] Registration failed:', err);
    }
  });
}

// ─── UPDATE BANNER ────────────────────────────────────────────
/**
 * Show a non-intrusive bottom banner telling the user a new
 * version is available with an "Update Now" button.
 * @param {ServiceWorker} newWorker
 */
function _showUpdateBanner(newWorker) {
  // Avoid duplicate banners
  if (document.getElementById('sw-update-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'sw-update-banner';
  banner.innerHTML = `
    <div class="sw-banner-content">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/>
        <path d="M10 6v5l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <span>A new version of GradeFlow is available.</span>
    </div>
    <button id="sw-update-btn" class="sw-update-btn">Update Now</button>
    <button id="sw-dismiss-btn" class="sw-dismiss-btn" aria-label="Dismiss">✕</button>
  `;
  document.body.appendChild(banner);

  // Trigger animation
  requestAnimationFrame(() => banner.classList.add('sw-banner-visible'));

  // Update button → tell SW to skip waiting → controllerchange fires → reload
  document.getElementById('sw-update-btn').addEventListener('click', () => {
    newWorker.postMessage({ type: 'SKIP_WAITING' });
  });

  // Dismiss button
  document.getElementById('sw-dismiss-btn').addEventListener('click', () => {
    banner.classList.remove('sw-banner-visible');
    setTimeout(() => banner.remove(), 300);
  });
}
