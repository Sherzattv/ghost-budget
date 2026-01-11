/**
 * Ghost Budget — Service Worker v2.0
 * Optimized for Supabase architecture
 */

const CACHE_NAME = 'ghost-budget-v2-supabase';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/js/main.js',
    '/js/config.js',
    '/js/supabase/client.js',
    '/js/supabase/auth.js',
    '/js/supabase/accounts.js',
    '/js/supabase/transactions.js',
    '/js/supabase/categories.js',
    '/js/supabase/index.js',
    '/manifest.json',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png'
];

// Install — cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch Strategy
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip Supabase API calls — always use network
    if (url.hostname.includes('supabase')) {
        return;
    }

    // Navigation (HTML): Network First
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    // Static Assets: Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request).then(cached => {
            const networkFetch = fetch(event.request).then(res => {
                if (res.ok) {
                    caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
                }
                return res;
            }).catch(() => cached);

            return cached || networkFetch;
        })
    );
});
