// MAGA Service Worker
// Banking-grade PWA with offline support

const CACHE_NAME = 'maga-app-v1';
const STATIC_CACHE_NAME = 'maga-static-v1';
const DATA_CACHE_NAME = 'maga-data-v1';

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/lend',
  '/borrow',
  '/farm',
  '/manifest.json',
  '/_next/static/css/app/globals.css',
  // Add other critical static assets
];

// API endpoints that can be cached temporarily
const API_ENDPOINTS = [
  '/api/markets',
  '/api/analytics',
  '/api/positions',
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE_NAME).then(cache => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DATA_CACHE_NAME) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-HTTP requests
  if (!request.url.startsWith('http')) {
    return;
  }
  
  // Handle different types of requests
  if (request.url.includes('/api/') || request.url.includes('solana')) {
    // API requests - Network first with cache fallback
    event.respondWith(networkFirstStrategy(request));
  } else if (request.destination === 'document') {
    // HTML documents - Network first with cache fallback
    event.respondWith(networkFirstStrategy(request));
  } else if (request.destination === 'script' || 
             request.destination === 'style' ||
             request.destination === 'font') {
    // Static assets - Cache first with network fallback
    event.respondWith(cacheFirstStrategy(request));
  } else {
    // Default - Network first
    event.respondWith(networkFirstStrategy(request));
  }
});

// Network first strategy (for dynamic content)
async function networkFirstStrategy(request) {
  const cache = await caches.open(DATA_CACHE_NAME);
  
  try {
    // Try network first
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[Service Worker] Network failed, trying cache:', request.url);
    
    // Fallback to cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If no cache, return offline page for HTML documents
    if (request.destination === 'document') {
      return createOfflineResponse();
    }
    
    throw error;
  }
}

// Cache first strategy (for static assets)
async function cacheFirstStrategy(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    // Fallback to network
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[Service Worker] Cache and network failed for:', request.url);
    throw error;
  }
}

// Create offline response for HTML documents
function createOfflineResponse() {
  const offlineHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Offline - MAGA</title>
      <style>
        body {
          font-family: 'Inter', sans-serif;
          background: #f7fafc;
          color: #2d3748;
          margin: 0;
          padding: 20px;
          text-align: center;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
        .offline-container {
          background: white;
          border-radius: 12px;
          padding: 40px;
          max-width: 600px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          border: 1px solid #e2e8f0;
        }
        .error-code {
          color: #e53e3e;
          font-size: 1.2em;
          font-weight: 600;
          margin-bottom: 20px;
        }
        .logo {
          color: #3182ce;
          font-size: 2em;
          font-weight: bold;
          margin-bottom: 20px;
        }
        .message {
          color: #4a5568;
          margin-bottom: 10px;
          line-height: 1.5;
        }
        .retry-btn {
          background: #3182ce;
          border: none;
          color: white;
          padding: 12px 24px;
          font-family: 'Inter', sans-serif;
          font-weight: 500;
          border-radius: 8px;
          cursor: pointer;
          margin-top: 20px;
          transition: all 0.2s;
        }
        .retry-btn:hover {
          background: #2c5aa0;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(49, 130, 206, 0.3);
        }
        .status-indicator {
          display: inline-block;
          width: 8px;
          height: 8px;
          background: #ed8936;
          border-radius: 50%;
          margin-right: 8px;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="error-code">
          <span class="status-indicator"></span>
          CONNECTION UNAVAILABLE
        </div>
        <div class="logo">MAGA</div>
        <p class="message">Unable to connect to the network</p>
        <p class="message">Please check your internet connection and try again</p>
        <p class="message">Some cached data may still be available</p>
        <button class="retry-btn" onclick="window.location.reload()">
          Retry Connection
        </button>
      </div>
    </body>
    </html>
  `;
  
  return new Response(offlineHTML, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
    },
  });
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
    const cache = await caches.open(DATA_CACHE_NAME);
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

console.log('[Service Worker] Loaded successfully');