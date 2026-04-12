const CACHE_NAME = 'anrac-v1'
const TILE_CACHE = 'anrac-tiles-v1'

// App shell to cache
const APP_SHELL = [
  '/',
  '/index.html',
]

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== TILE_CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Tile requests → cache-first (for offline map)
  if (
    url.hostname.includes('google.com') ||
    url.hostname.includes('arcgisonline.com') ||
    url.hostname.includes('cartocdn.com') ||
    url.hostname.includes('basemaps')
  ) {
    event.respondWith(
      caches.open(TILE_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached
          return fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone())
            return response
          }).catch(() => new Response('', { status: 404 }))
        })
      )
    )
    return
  }

  // Google Fonts → cache-first
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached
          return fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone())
            return response
          }).catch(() => new Response('', { status: 404 }))
        })
      )
    )
    return
  }

  // Only cache GET requests (Cache API doesn't support POST/PUT/DELETE)
  if (event.request.method !== 'GET') return

  // App files → network-first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})

// Message handler for tile pre-caching
self.addEventListener('message', (event) => {
  if (event.data.type === 'CACHE_TILES') {
    const { tiles } = event.data
    caches.open(TILE_CACHE).then((cache) => {
      let done = 0
      const total = tiles.length
      tiles.forEach((tileUrl) => {
        fetch(tileUrl).then((response) => {
          if (response.ok) cache.put(tileUrl, response)
          done++
          if (done % 10 === 0 || done === total) {
            self.clients.matchAll().then((clients) =>
              clients.forEach((c) => c.postMessage({ type: 'CACHE_PROGRESS', done, total }))
            )
          }
        }).catch(() => { done++ })
      })
    })
  }
})
