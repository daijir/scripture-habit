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
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/favicon-192.png',
        data: payload.data
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
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
    self.skipWaiting();
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
