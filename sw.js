// ぬいもん service worker: offline start without stale versions.
// - Cross-origin (Supabase, Google login, PeerJS, fonts) and non-GET: untouched.
// - URLs with ?v= are immutable: cache-first by full URL (a new version = a new URL).
// - Everything else (index.html, navigations, assets): network-first, cache only as offline fallback.
const CACHE = 'nuimon-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.searchParams.has('v')) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) {
        c.put(req, res.clone());
        // drop older versions of the same file
        for (const k of await c.keys()) { const u = new URL(k.url); if (u.pathname === url.pathname && u.search !== url.search) c.delete(k); }
      }
      return res;
    }));
    return;
  }
  const nav = req.mode === 'navigate';
  e.respondWith(fetch(req).then(res => {
    if (res.ok && res.type === 'basic') {
      const copy = res.clone(), key = nav ? new Request(url.origin + url.pathname) : req;
      caches.open(CACHE).then(c => c.put(key, copy));
    }
    return res;
  }).catch(async () => {
    const c = await caches.open(CACHE);
    return (await c.match(nav ? new Request(url.origin + url.pathname) : req, { ignoreSearch: nav }))
      || (nav && await c.match(new URL('index.html', self.registration.scope).href)) || Response.error();
  }));
});
