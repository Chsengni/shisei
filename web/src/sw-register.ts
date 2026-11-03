// Register the image-caching service worker (web/sw/sw.ts → sw.js at the site root). The site root comes from the
// menu data every page carries, so language folders and pose pages all register the same worker and scope.
export function registerSW(): void {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const root = window.SHISEI_NAV?.root ?? window.SHISEI?.base ?? './';
  const url = new URL(root + 'sw.js', location.href);
  // After load: the worker's install must not compete with the first screen of images.
  const go = () => { navigator.serviceWorker.register(url, { scope: new URL(root, location.href).pathname }).catch(() => { /* old browser or blocked */ }); };
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
}
