import { messaging, db } from '../firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

// VAPID Key from Firebase Console (Messaging -> Web Push certificates)
const VAPID_KEY = "BM2Y3WcLC7cH5CHND3nzDh2eoNvsIxc7X2aRTaQj0TXENvee9klPqLrJvb8x2DfQ-yMgMHlXMhkal0tt6czIaKM";

export const requestNotificationPermission = async (userId) => {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');

            try {
                // Force a fresh registration of the service worker to clear any broken states
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const reg of regs) {
                    if (reg.scope.includes(window.location.host)) {
                        console.log('Unregistering existing SW to reset state:', reg.scope);
                        await reg.unregister();
                    }
                }

                const registration = await navigator.serviceWorker.register('/sw.js');
                await navigator.serviceWorker.ready;

                console.log('Fresh SW Registration ready:', registration);

                if (!registration.active) {
                    console.error('Service worker registration failed or not active.');
                    return;
                }

                // Get FCM token
                const token = await getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: registration
                });

                if (token) {
                    console.log('FCM Token:', token);
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
                    console.log('No registration token available.');
                }
            } catch (innerError) {
                console.error('Error during SW registration/token process:', innerError);
                throw innerError;
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
