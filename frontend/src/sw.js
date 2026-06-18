// Variable inyectada por vite-plugin-pwa en build time
// Lo asignamos a self para evitar que el minificador (esbuild) lo borre
self.__precacheManifest = [].concat(self.__WB_MANIFEST || []);

// IMPORTANTE: subir esta versión purga caches viejos (incluido el shell HTML
// y assets envenenados con text/html) en el evento 'activate'.
const CACHE_NAME = 'sportmaps-v2'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// Instalación — cachear assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  )
})

// Activación — limpiar caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Fetch — Network first para API, Cache first para assets
self.addEventListener('fetch', (event) => {
  // Solo interceptar peticiones GET. POST, PUT, DELETE, etc. no son soportados por la Cache API
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // Supabase API y Edge Functions → Network First, NO CACHEAR Auth ni Realtime
  if (url.hostname.includes('supabase.co')) {
    // No interceptar peticiones de Auth o Realtime para evitar bloqueos del LockManager
    if (url.pathname.includes('/auth/v1/') || url.pathname.includes('/realtime/v1/')) {
      return; 
    }

    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok && event.request.method === 'GET') {
            const clone = response.clone()
            caches.open('supabase-api').then(cache => cache.put(event.request, clone))
          }
          return response
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          return cached || new Response('Supabase connection error', { 
            status: 503, 
            headers: { 'Content-Type': 'text/plain' } 
          });
        })
    )
    return
  }

  // Assets estáticos → cache first
  if (event.request.destination === 'image' ||
      event.request.destination === 'font'  ||
      url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => cached || fetch(event.request))
    )
    return
  }

  // JS / CSS / módulos / assets con hash → network only, SIN fallback al shell.
  // Servir index.html (text/html) para un <script> produce el error de MIME
  // "Expected a JavaScript-or-Wasm module script ... text/html" y rompe los
  // imports dinámicos (lazy) tras un redeploy con hashes nuevos. Preferimos un
  // 503 (que dispara vite:preloadError → reload) antes que devolver HTML.
  if (
    event.request.destination === 'script' ||
    event.request.destination === 'style'  ||
    event.request.destination === 'worker' ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // No cachear respuestas que no sean OK ni HTML servido por el rewrite SPA
          const ct = response.headers.get('content-type') || ''
          if (response.ok && !ct.includes('text/html')) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
          }
          return response
        })
        .catch(async () => {
          const cached = await caches.match(event.request)
          return cached || new Response('Asset no disponible', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          })
        })
    )
    return
  }

  // Navegaciones (documentos HTML) → network first, fallback al shell offline.
  // Solo aquí es correcto devolver index.html.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put('/index.html', clone))
          }
          return response
        })
        .catch(async () => {
          const shell = await caches.match('/index.html')
          return shell || new Response('Sin conexión', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          })
        })
    )
    return
  }

  // Resto de peticiones GET → network first con cache, SIN fallback al shell.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(event.request)
        return cached || new Response('Network error occurred', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' }),
        })
      })
  )
})

// ─── Push Notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const { title = 'SportMaps', body = '', url = '/', type = 'default' } = data

  const iconMap = {
    installment_received: '/icons/icon-192.png',  // abono recibido
    installment_approved: '/icons/icon-192.png',  // abono aprobado
    installment_rejected: '/icons/icon-192.png',  // abono rechazado
    payment_due:          '/icons/icon-192.png',  // pago próximo a vencer
    default:              '/icons/icon-192.png',
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: iconMap[type] || iconMap.default,
      badge: '/icons/icon-96.png',
      data: { url, type },
      vibrate: [200, 100, 200],
      requireInteraction: type === 'installment_received', // escuela debe ver esto
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        const existing = clientList.find(c => c.url.includes(targetUrl))
        if (existing) return existing.focus()
        return clients.openWindow(targetUrl)
      })
  )
})
