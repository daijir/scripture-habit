import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getMessaging, isSupported } from "firebase/messaging";

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

/** @type {import("firebase/analytics").Analytics | null} */
let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (err) {
  console.log("Firebase Analytics not supported in this environment");
}

/** @type {import("firebase/auth").Auth | null} */
let auth = null;
try {
  auth = getAuth(app);
} catch (err) {
  console.log("Firebase Auth failed to initialize");
}

/** @type {import("firebase/messaging").Messaging | null} */
let messaging = null;
if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) {
        try {
          messaging = getMessaging(app);
        } catch (e) {
          console.log("getMessaging failed:", e.message);
        }
      }
    })
    .catch((err) => {
      console.log("Firebase Messaging check failed:", err.message);
    });
}

// Initialize Firestore with persistent cache (modern way)
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export { app, analytics, auth, db, messaging };

