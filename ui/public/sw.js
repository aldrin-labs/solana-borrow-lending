// MAGA Service Worker
// Banking-grade PWA with offline support and cache version migration

// Debug utility for service worker
const DEBUG_ENABLED = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
const debugLog = {
  info: (message, ...args) => {
    if (DEBUG_ENABLED) {
      console.log(`[Service Worker] ${message}`, ...args);
    }
  },
  warn: (message, ...args) => {
    if (DEBUG_ENABLED) {
      console.warn(`[Service Worker] ${message}`, ...args);
    }
  },
  error: (message, ...args) => {
    console.error(`[Service Worker] ${message}`, ...args);
  }
};

// Cache version management - utility for incremental versioning
class CacheVersionManager {
  static generateVersion() {
    // Create version based on timestamp and build info
    const buildTime = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const buildNumber = Math.floor(Date.now() / 1000) % 10000; // Last 4 digits of timestamp
    return `v${buildTime}-${buildNumber}`;
  }
  
  static isValidVersion(version) {
    return /^v\d{8}-\d{4}$/.test(version);
  }
}

// Cache version - increment when major changes occur
const CACHE_VERSION = 'v3'; // Increment for major changes, or use auto-generation for CI/CD
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

    debugLog.info('Found old caches to delete:', oldCacheNames);

    // Delete old caches
    const deletionPromises = oldCacheNames.map(cacheName => {
      debugLog.info('Deleting old cache:', cacheName);
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
      debugLog.warn('Critical assets missing from cache:', criticalMissing);
      // Re-cache missing critical assets
      await staticCache.addAll(criticalMissing);
    }
  }
}

// Install event - cache static assets
self.addEventListener('install', event => {
  debugLog.info('Installing version:', CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(CACHE_NAMES.STATIC).then(cache => {
        debugLog.info('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );
});

// Activate event - cleanup old caches and migrate
self.addEventListener('activate', event => {
  debugLog.info('Activating version:', CACHE_VERSION);
  
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

// Enhanced stale-while-revalidate strategy for data requests
async function handleDataRequest(request) {
  const cache = await caches.open(CACHE_NAMES.DATA);
  const url = new URL(request.url);
  
  // Check if this is a high-priority request that needs fresh data
  const isHighPriority = url.pathname.includes('/api/health') || 
                        url.pathname.includes('/api/prices') ||
                        url.searchParams.has('fresh');
  
  // Get cached response immediately
  const cachedResponse = await cache.match(request);
  
  // Define cache thresholds based on endpoint type
  const getCacheThresholds = (pathname) => {
    if (pathname.includes('/api/markets') || pathname.includes('/api/analytics')) {
      return { fresh: 60000, stale: 300000 }; // 1min fresh, 5min stale
    } else if (pathname.includes('/api/positions')) {
      return { fresh: 30000, stale: 120000 }; // 30sec fresh, 2min stale
    } else if (pathname.includes('/api/health')) {
      return { fresh: 5000, stale: 15000 };   // 5sec fresh, 15sec stale
    } else {
      return { fresh: 120000, stale: 600000 }; // 2min fresh, 10min stale
    }
  };
  
  const thresholds = getCacheThresholds(url.pathname);
  
  // Check cache freshness
  let cacheStatus = 'miss';
  let shouldRevalidate = true;
  
  if (cachedResponse) {
    const cachedAt = cachedResponse.headers.get('sw-cached-at');
    const cacheAge = cachedAt ? Date.now() - parseInt(cachedAt) : Infinity;
    
    if (cacheAge < thresholds.fresh) {
      cacheStatus = 'fresh';
      shouldRevalidate = false;
    } else if (cacheAge < thresholds.stale) {
      cacheStatus = 'stale';
      shouldRevalidate = true;
    } else {
      cacheStatus = 'expired';
      shouldRevalidate = true;
    }
  }
  
  // For high-priority requests, always try network first
  if (isHighPriority) {
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        // Cache the fresh response
        await cacheResponse(cache, request, networkResponse.clone());
        return networkResponse;
      }
    } catch (error) {
      debugLog.warn('High-priority network request failed:', error);
    }
    
    // Fall back to cache if network fails
    if (cachedResponse && cacheStatus !== 'expired') {
      return createCachedResponse(cachedResponse, cacheStatus);
    }
  }
  
  // Stale-while-revalidate strategy
  if (cachedResponse && cacheStatus !== 'expired') {
    // Return cached response immediately
    const responseToReturn = createCachedResponse(cachedResponse, cacheStatus);
    
    // Revalidate in background if needed
    if (shouldRevalidate) {
      debugLog.info('Revalidating stale cache in background');
      
      // Don't await - revalidate in background
      fetch(request)
        .then(async networkResponse => {
          if (networkResponse.ok) {
            await cacheResponse(cache, request, networkResponse.clone());
            debugLog.info('Background revalidation completed');
          }
        })
        .catch(error => {
          debugLog.warn('Background revalidation failed:', error);
        });
    }
    
    return responseToReturn;
  }
  
  // No cache or expired cache - try network
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses
      await cacheResponse(cache, request, networkResponse.clone());
      return networkResponse;
    }
    
    // Network response not ok, fall back to expired cache if available
    if (cachedResponse) {
      debugLog.info('Serving expired cache due to network error');
      return createCachedResponse(cachedResponse, 'expired');
    }
    
    // No cache available, return error response
    return createOfflineResponse();
  } catch (error) {
    debugLog.warn('Network request failed:', error);
    
    // Network failed, try expired cache
    if (cachedResponse) {
      debugLog.info('Serving expired cache due to network failure');
      return createCachedResponse(cachedResponse, 'expired');
    }
    
    // No cache available, return offline response
    return createOfflineResponse();
  }
}

// Helper function to cache responses with metadata
async function cacheResponse(cache, request, response) {
  const responseToCache = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      'sw-cached-at': Date.now().toString(),
      'sw-cache-version': CACHE_VERSION,
      'sw-cache-url': request.url,
    }
  });
  
  await cache.put(request, responseToCache);
}

// Helper function to create cached response with status
function createCachedResponse(cachedResponse, status) {
  return new Response(cachedResponse.body, {
    status: cachedResponse.status,
    statusText: cachedResponse.statusText,
    headers: {
      ...Object.fromEntries(cachedResponse.headers.entries()),
      'sw-cache-status': status,
      'sw-served-at': Date.now().toString(),
    }
  });
}

// Helper function to create offline response
function createOfflineResponse() {
  return new Response(JSON.stringify({
    error: 'Network unavailable',
    offline: true,
    timestamp: Date.now(),
    message: 'Please check your internet connection and try again.',
  }), {
    status: 503,
    headers: { 
      'Content-Type': 'application/json',
      'sw-cache-status': 'offline'
    }
  });
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
  debugLog.info('Background sync:', event.tag);
  
  if (event.tag === 'solana-data-sync') {
    event.waitUntil(syncSolanaData());
  }
});

// Sync Solana data in background
async function syncSolanaData() {
  try {
    debugLog.info('Syncing Solana data...');
    
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
    
    debugLog.info('Solana data synced successfully');
  } catch (error) {
    debugLog.error('Failed to sync Solana data:', error);
  }
}

// Push notification handling (for future implementation)
self.addEventListener('push', event => {
  debugLog.info('Push received:', event);
  
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
  debugLog.info('Notification clicked:', event);
  
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
  debugLog.info('Message received:', event.data);
  
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

debugLog.info('Loaded successfully with version:', CACHE_VERSION);