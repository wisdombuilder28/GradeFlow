/**
 * registerSW.js — Service Worker registration + update handling.
 * Forces immediate activation on every new deploy.
 */

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      // Unregister ALL old service workers first
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
        console.log('[SW] Unregistered old SW');
      }

      // Clear ALL caches
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map(key => caches.delete(key)));
      console.log('[SW] All caches cleared');

      // Register fresh SW
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.info('[SW] Registered fresh. Scope:', registration.scope);

      // Detect new SW waiting
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            _showUpdateBanner(newWorker);
          }
        });
      });

      // Reload after SW takes control
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

function _showUpdateBanner(newWorker) {
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

  requestAnimationFrame(() => banner.classList.add('sw-banner-visible'));

  document.getElementById('sw-update-btn').addEventListener('click', () => {
    newWorker.postMessage({ type: 'SKIP_WAITING' });
  });

  document.getElementById('sw-dismiss-btn').addEventListener('click', () => {
    banner.classList.remove('sw-banner-visible');
    setTimeout(() => banner.remove(), 300);
  });
}
