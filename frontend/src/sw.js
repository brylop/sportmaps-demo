// Variable inyectada por vite-plugin-pwa en build time
// Lo asignamos a self para evitar que el minificador (esbuild) lo borre
self.__precacheManifest = [].concat(self.__WB_MANIFEST || []);

const CACHE_NAME = 'sportmaps-v1'
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

  // Rutas de la app → network first con fallback a cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        
        const shell = await caches.match('/index.html');
        if (shell) return shell;

        // Si nada funciona, devolver una respuesta de error válida en lugar de undefined
        return new Response('Network error occurred', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
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
