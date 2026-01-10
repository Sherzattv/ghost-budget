const CACHE_NAME = 'ghost-budget-v5-autoupdate';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    // '/data/budget.json', // Dynamic now
    '/manifest.json',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png'
];

// Install — cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
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

// Fetch Strategies
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. Data File: Network First (Critical for correctness)
    if (url.pathname.includes('budget.json')) {
        event.respondWith(
            fetch(event.request)
                .then(res => {
                    if (res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                    }
                    return res;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // 2. HTML (Navigation): Network First (Critical for updates)
    // This ensures we always get the new index.html if we are online.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(res => {
                    return res;
                })
                .catch(() => {
                    return caches.match('/index.html') || caches.match('/');
                })
        );
        return;
    }

    // 3. Static Assets (CSS, JS, Images): Stale-While-Revalidate
    // Serve cache immediately, but update it in background for next time.
    event.respondWith(
        caches.match(event.request).then(cached => {
            const networkFetch = fetch(event.request).then(res => {
                if (res.ok) {
                    caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
                }
                return res;
            });
            return cached || networkFetch;
        })
    );
});
