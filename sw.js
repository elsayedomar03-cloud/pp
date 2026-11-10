// Service worker: salva l'app sul telefono così si apre anche senza rete,
// e conserva le tile della mappa online che hai già guardato.
const CACHE = 'trekmap-v2';
const TILES = 'trekmap-tiles';
const MAX_TILES = 4000;
const FILES = ['./', 'index.html', 'app.js', 'mbtiles.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== TILES).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function trimTiles(c) {
  const keys = await c.keys();
  if (keys.length > MAX_TILES) await Promise.all(keys.slice(0, keys.length - MAX_TILES + 500).map((k) => c.delete(k)));
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Tile della mappa online: prima la copia salvata, poi la rete (e la salvo).
  if (url.hostname.endsWith('tile.opentopomap.org')) {
    e.respondWith((async () => {
      const c = await caches.open(TILES);
      const hit = await c.match(e.request);
      if (hit) return hit;
      try {
        const r = await fetch(e.request);
        if (r.ok || r.type === 'opaque') {
          await c.put(e.request, r.clone());
          if (Math.random() < 0.02) trimTiles(c);
        }
        return r;
      } catch {
        return Response.error();
      }
    })());
    return;
  }

  // File dell'app: prima la rete (aggiornamenti quando sei online), altrimenti la copia salvata
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok && url.origin === location.origin) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
