// MAGA Service Worker
// Banking-grade PWA with offline support and cache version migration

// Cache version management - constants defined inline for SW compatibility
const CACHE_VERSION = 'v2'; // Increment when major changes occur
const CACHE_NAMES = {
  STATIC: `maga-static-${CACHE_VERSION}`,
  DYNAMIC: `maga-dynamic-${CACHE_VERSION}`,
  DATA: `maga-data-${CACHE_VERSION}`,
  IMAGES: `maga-images-${CACHE_VERSION}`,
};

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/lend',
  '/borrow',
  '/farm',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/_next/static/css/app/globals.css',
  // Add other critical static assets
];

// API endpoints that can be cached temporarily
const API_ENDPOINTS = [
  '/api/markets',
  '/api/analytics',
  '/api/positions',
];

// Cache strategies for different resource types
const CACHE_STRATEGIES = {
  STATIC: 'cache-first',
  DYNAMIC: 'network-first',
  DATA: 'network-first-with-fallback',
  IMAGES: 'cache-first-with-fallback',
};

// Cache version migration utility
class CacheVersionManager {
  static async migrateCache() {
    const allCacheNames = await caches.keys();
    const oldCacheNames = allCacheNames.filter(name => 
      name.startsWith('maga-') && !Object.values(CACHE_NAMES).includes(name)
    );

    console.log('[Service Worker] Found old caches to delete:', oldCacheNames);

    // Delete old caches
    const deletionPromises = oldCacheNames.map(cacheName => {
      console.log('[Service Worker] Deleting old cache:', cacheName);
      return caches.delete(cacheName);
    });

    return Promise.all(deletionPromises);
  }

  static async validateCacheIntegrity() {
    // Check if critical caches exist and are valid
    const staticCache = await caches.open(CACHE_NAMES.STATIC);
    const cachedUrls = await staticCache.keys();
    
    const criticalMissing = STATIC_ASSETS.filter(asset => 
      !cachedUrls.some(req => req.url.endsWith(asset))
    );

    if (criticalMissing.length > 0) {
      console.warn('[Service Worker] Critical assets missing from cache:', criticalMissing);
      // Re-cache missing critical assets
      await staticCache.addAll(criticalMissing);
    }
  }
}

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing version:', CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(CACHE_NAMES.STATIC).then(cache => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );
});

// Activate event - cleanup old caches and migrate
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating version:', CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Migrate and cleanup old caches
      CacheVersionManager.migrateCache(),
      
      // Validate cache integrity
      CacheVersionManager.validateCacheIntegrity(),
      
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

// Fetch event - implement intelligent caching strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-HTTP requests
  if (!request.url.startsWith('http')) {
    return;
  }
  
  // Handle different types of requests with appropriate strategies
  if (request.url.includes('/api/') || request.url.includes('solana')) {
    // API requests - Network first with cache fallback
    event.respondWith(handleDataRequest(request));
  } else if (request.destination === 'document') {
    // HTML documents - Network first with cache fallback
    event.respondWith(handleDocumentRequest(request));
  } else if (request.destination === 'script' || 
             request.destination === 'style' ||
             request.destination === 'font') {
    // Static assets - Cache first with network fallback
    event.respondWith(handleStaticRequest(request));
  } else if (request.destination === 'image') {
    // Images - Cache first with network fallback
    event.respondWith(handleImageRequest(request));
  } else {
    // Default - Network first
    event.respondWith(handleDynamicRequest(request));
  }
});

// Enhanced network first strategy for data requests
async function handleDataRequest(request) {
  const cache = await caches.open(CACHE_NAMES.DATA);
  
  try {
    // Try network first
    const response = await fetch(request);
    
    if (response.ok) {
      // Cache successful responses with expiration
      const responseClone = response.clone();
      const cacheResponse = new Response(responseClone.body, {
        status: responseClone.status,
        statusText: responseClone.statusText,
        headers: {
          ...Object.fromEntries(responseClone.headers.entries()),
          'sw-cached-at': Date.now().toString(),
          'sw-cache-expires': (Date.now() + 300000).toString(), // 5 minutes
        }
      });
      cache.put(request, cacheResponse);
    }
    
    return response;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      const cachedAt = cachedResponse.headers.get('sw-cached-at');
      const expiresAt = cachedResponse.headers.get('sw-cache-expires');
      
      // Check if cache is still valid
      if (expiresAt && Date.now() < parseInt(expiresAt)) {
        console.log('[Service Worker] Serving fresh cached data');
        return cachedResponse;
      } else {
        console.log('[Service Worker] Serving stale cached data');
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          statusText: cachedResponse.statusText,
          headers: {
            ...Object.fromEntries(cachedResponse.headers.entries()),
            'sw-cache-status': 'stale'
          }
        });
      }
    }
    
    // No cache available, return offline response
    return new Response(JSON.stringify({
      error: 'Network unavailable',
      offline: true,
      timestamp: Date.now()
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Cache first strategy for static assets
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAMES.STATIC);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Return offline fallback for critical assets
    return new Response('Offline', { 
      status: 503, 
      statusText: 'Service Unavailable' 
    });
  }
}

// Handle document requests with navigation fallback
async function handleDocumentRequest(request) {
  const cache = await caches.open(CACHE_NAMES.DYNAMIC);
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Try cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page
    const offlineResponse = await cache.match('/');
    if (offlineResponse) {
      return offlineResponse;
    }
    
    // Final fallback
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>MAGA - Offline</title>
          <style>
            body { font-family: monospace; background: #000; color: #00ff00; padding: 20px; }
            .terminal { border: 1px solid #00ff00; padding: 20px; }
          </style>
        </head>
        <body>
          <div class="terminal">
            <h1>MAGA - OFFLINE MODE</h1>
            <p>Network connection unavailable.</p>
            <p>Please check your connection and try again.</p>
            <button onclick="location.reload()">RETRY CONNECTION</button>
          </div>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Handle image requests with cache optimization
async function handleImageRequest(request) {
  const cache = await caches.open(CACHE_NAMES.IMAGES);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Return placeholder or cached version
    return new Response('', { status: 404 });
  }
}

// Handle dynamic requests
async function handleDynamicRequest(request) {
  const cache = await caches.open(CACHE_NAMES.DYNAMIC);
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    return cachedResponse || new Response('Offline', { status: 503 });
  }
}

// Background sync for data updates
self.addEventListener('sync', event => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'solana-data-sync') {
    event.waitUntil(syncSolanaData());
  }
});

// Sync Solana data in background
async function syncSolanaData() {
  try {
    console.log('[Service Worker] Syncing Solana data...');
    
    // Fetch fresh data
    const responses = await Promise.all([
      fetch('/api/markets'),
      fetch('/api/analytics'),
    ]);
    
    // Cache fresh data
    const cache = await caches.open(CACHE_NAMES.DATA);
    responses.forEach((response, index) => {
      if (response.ok) {
        const urls = ['/api/markets', '/api/analytics'];
        cache.put(urls[index], response.clone());
      }
    });
    
    console.log('[Service Worker] Solana data synced successfully');
  } catch (error) {
    console.error('[Service Worker] Failed to sync Solana data:', error);
  }
}

// Push notification handling (for future implementation)
self.addEventListener('push', event => {
  console.log('[Service Worker] Push received:', event);
  
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'Market update available',
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      tag: 'maga-update',
      renotify: true,
      actions: [
        {
          action: 'view',
          title: 'View Dashboard',
          icon: '/icon-96x96.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icon-96x96.png'
        }
      ],
      data: {
        url: data.url || '/'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(
        data.title || 'MAGA - Make Aldrin Great Again',
        options
      )
    );
  }
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification clicked:', event);
  
  event.notification.close();
  
  if (event.action === 'view') {
    const url = event.notification.data.url || '/';
    event.waitUntil(
      self.clients.openWindow(url)
    );
  }
});

// Message handling for manual cache updates
self.addEventListener('message', event => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'UPDATE_CACHE') {
    event.waitUntil(
      Promise.all([
        CacheVersionManager.migrateCache(),
        CacheVersionManager.validateCacheIntegrity()
      ])
    );
  }
});

console.log('[Service Worker] Loaded successfully with version:', CACHE_VERSION);