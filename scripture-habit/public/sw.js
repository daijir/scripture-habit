// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyCBgfSff0SJ6Rg1tGmU2z4MBccGMrA2jbM",
    authDomain: "scripture-habit-auth.firebaseapp.com",
    projectId: "scripture-habit-auth",
    storageBucket: "scripture-habit-auth.firebasestorage.app",
    messagingSenderId: "346318604907",
    appId: "1:346318604907:web:38afde63adfcdeaeb7bf2e"
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage((payload) => {
    console.log('[sw.js] Received background message ', payload);

    // Use data payload since we removed top-level notification to avoid double notifications
    const notificationTitle = payload.data?.title || 'Scripture Habit';
    const notificationOptions = {
        body: payload.data?.body || '',
        icon: '/favicon-192.png',
        badge: '/favicon-192.png', // Android status bar badge
        data: payload.data,
        // Removed fixed tag to ensure every message shows up, avoiding potential order issues with "renotify"
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const data = event.notification.data;
    const groupId = data?.groupId;
    const targetPath = groupId ? `/group/${groupId}` : '/dashboard';
    const urlToOpen = new URL(targetPath, self.location.origin).href;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Try to find a window that is already open on our site
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    // Check if the client is part of our app (sharing the same origin)
                    if (client.url.startsWith(self.location.origin)) {
                        // Focus the existing window and navigate to the target path
                        if ('focus' in client) {
                            client.navigate(urlToOpen);
                            return client.focus();
                        }
                    }
                }
                // If no window is open, open a new one (ideally in the PWA scope)
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

const CACHE_NAME = 'scripture-habit-v1';
const OFFLINE_URL = '/offline.html';

const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    OFFLINE_URL,
    '/logo.svg',
    '/manifest.json'
];

// Install Event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('SW: Pre-caching offline page and assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Activate Event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('SW: Clearing old cache');
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
    // We only want to handle GET requests
    if (event.request.method !== 'GET') return;

    // Handle navigation requests (index.html)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match(OFFLINE_URL);
            })
        );
        return;
    }

    // For everything else, use Cache First strategy for static assets, 
    // or Network First strategy for API/Dynamic content
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).then((networkResponse) => {
                // Cache external fonts or static images on the fly if needed
                if (event.request.url.startsWith('https://fonts.')) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            });
        }).catch(() => {
            // If font or static asset fails and is not in cache, just fail silently or return offline UI if important
            if (event.request.destination === 'image') {
                return caches.match('/logo.svg');
            }
        })
    );
});
