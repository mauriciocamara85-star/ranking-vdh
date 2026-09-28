const CACHE = 'vdh-ranking-v2';
const SHELL = ['./', './index.html', './app.js', './styles.css', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Los datos del ranking siempre van a la red — nunca se cachean, tienen que ser en vivo.
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleusercontent.com')) {
    event.respondWith(fetch(event.request));
    return;
  }
  // El shell de la app: red primero (para traer actualizaciones), cache como respaldo offline.
  // cache:'no-store' es clave — sin esto, el fetch respeta el Cache-Control de GitHub Pages y en
  // un celular puede resolver del caché HTTP del navegador sin tocar la red, mostrando un app.js
  // viejo aunque el deploy nuevo ya esté arriba (pasó con el ajuste de Sole Lescano, 2026-09-27).
  if (event.request.method === 'GET' && url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request, {cache: 'no-store'})
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
