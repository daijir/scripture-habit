import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getMessaging } from "firebase/messaging"; // Add this

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

// Initialize messaging with support check to avoid crashes in in-app browsers
let messaging = null;

// Only try to initialize if we are in a browser environment
if (typeof window !== 'undefined') {
  try {
    // Note: getMessaging() itself can throw if the browser is unsupported
    // In some SDK versions, we should use isSupported() before getMessaging()
    messaging = getMessaging(app);
  } catch (err) {
    console.warn("Firebase Messaging is not supported in this browser:", err.message);
  }
}

// Initialize Firestore with persistent cache (modern way)
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export { app, analytics, auth, db, messaging }; // Export messaging

