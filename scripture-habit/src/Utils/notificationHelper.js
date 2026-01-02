import { messaging, db } from '../firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

// VAPID Key from Firebase Console (Messaging -> Web Push certificates)
const VAPID_KEY = "BD7TWUVfuPC1A3RgUR8T8JQiQrbOCV-J9WPeCevFe3eNzJvOJRL6deOKpottaVbnmYKz4SgUnBEKLKX2Ji5PFCk";

export const requestNotificationPermission = async (userId) => {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');

            // Wait for the service worker to be fully ready and active
            const registration = await navigator.serviceWorker.ready;
            console.log('SW Registration ready:', registration);
            console.log('Active SW:', registration?.active);
            console.log('Scope:', registration?.scope);

            if (!registration || !registration.active) {
                console.error('Service worker is not active or ready!');
                return;
            }

            console.log('Using existing SW registration for Messaging:', registration);

            // Get FCM token
            const token = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });

            if (token) {
                console.log('FCM Token:', token);
                // Save token to user's profile in Firestore
                if (userId) {
                    const userRef = doc(db, 'users', userId);
                    await updateDoc(userRef, {
                        fcmTokens: arrayUnion(token)
                    });
                }
                import('react-toastify').then(({ toast }) => {
                    toast.success('Push notifications enabled! 🎉');
                });
                return token;
            } else {
                console.log('No registration token available. Request permission to generate one.');
            }
        } else {
            console.warn('Notification permission NOT granted. Status:', permission);
            if (permission === 'denied') {
                import('react-toastify').then(({ toast }) => {
                    toast.info('通知がブロックされています。ブラウザの設定から許可してください。');
                });
            }
        }
    } catch (error) {
        console.error('An error occurred during notification setup:', error);
        if (error.message) console.error('Error message:', error.message);
        if (error.code) console.error('Error code:', error.code);

        // Show user-friendly message instead of technical error
        import('react-toastify').then(({ toast }) => {
            toast.error('通知の設定に失敗しました。後でもう一度お試しください。');
        });
    }
};

// Handle foreground messages
export const onMessageListener = () =>
    new Promise((resolve) => {
        onMessage(messaging, (payload) => {
            resolve(payload);
        });
    });
