import { messaging, db } from '../firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

// VAPID Key from Firebase Console (Messaging -> Web Push certificates)
const VAPID_KEY = "BM2Y3WcLC7cH5CHND3nzDh2eoNvsIxc7X2aRTaQj0TXENvee9klPqLrJvb8x2DfQ-yMgMHlXMhkal0tt6czIaKM";

const isInAppBrowser = () => {
    const ua = window.navigator.userAgent || window.navigator.vendor || window.opera;
    return (ua.indexOf('FBAN') > -1) || (ua.indexOf('FBAV') > -1) || // Facebook
        (ua.indexOf('Instagram') > -1) || // Instagram
        (ua.indexOf('Line') > -1) || // LINE
        (ua.indexOf('Twitter') > -1) || // Twitter
        (ua.indexOf('Telegram') > -1); // Telegram
};

export const requestNotificationPermission = async (userId, t) => {
    // Fallback helper if t is not provided (though it should be)
    const translate = (key, defaultText) => (t ? t(key) : defaultText);

    // 1. Check basic support
    if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) {
        console.warn('Push notifications are not supported in this browser.');
        import('react-toastify').then(({ toast }) => {
            toast.warn(translate('notificationSetup.notSupported', 'Your browser does not support notification features. Please try with the latest Chrome or Safari.'));
        });
        return;
    }

    // 2. Check for In-App Browsers
    if (isInAppBrowser()) {
        console.warn('Push notifications often fail in In-App Browsers.');
        import('react-toastify').then(({ toast }) => {
            toast.info(translate('notificationSetup.inAppBrowserWarning', 'Notifications may not work in app-specific browsers. Please reopen in a standard browser (Chrome or Safari) using the button at the bottom right.'));
        });
    }

    try {
        // 3. Request Permission
        console.log('Requesting notification permission...');
        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
            console.log('Notification permission granted.');

            try {
                // 4. Register or Get Service Worker
                let registration;

                const existingRegs = await navigator.serviceWorker.getRegistrations();
                const ourReg = existingRegs.find(r => r.scope.includes(window.location.host));

                if (ourReg) {
                    console.log('Using existing SW registration:', ourReg.scope);
                    registration = ourReg;
                    await registration.update();
                } else {
                    console.log('Registering new Service Worker...');
                    registration = await navigator.serviceWorker.register('/sw.js', {
                        scope: '/'
                    });
                }

                // Wait for it to be ready
                await navigator.serviceWorker.ready;
                console.log('SW Registration ready:', registration);

                // 5. Check if active
                if (!registration.active && !registration.installing && !registration.waiting) {
                    console.error('Service worker registration failed to find an active worker.');
                    throw new Error('Service Worker not active after registration');
                }

                // 6. Get FCM token
                const token = await getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: registration
                });

                if (token) {
                    console.log('FCM Token successfully obtained:', token);
                    if (userId) {
                        const userRef = doc(db, 'users', userId);
                        await updateDoc(userRef, {
                            fcmTokens: arrayUnion(token)
                        });
                    }
                    import('react-toastify').then(({ toast }) => {
                        toast.success(translate('notificationSetup.success', 'Notification settings complete! 🎉'));
                    });
                    return token;
                } else {
                    console.log('No FCM token received.');
                    throw new Error('No registration token available');
                }
            } catch (innerError) {
                console.error('Detailed error during SW/Token process:', innerError);

                // Specific messaging for known errors
                let userFriendlyMsg = translate('notificationSetup.generalError', 'An error occurred while setting up notifications.');
                if (innerError.name === 'NotAllowedError') {
                    userFriendlyMsg = translate('notificationSetup.swRegistrationDenied', 'Service worker registration was denied by browser settings. Please disable Incognito/Private mode or check your settings.');
                } else if (innerError.code === 'messaging/permission-blocked') {
                    userFriendlyMsg = translate('notificationSetup.permissionBlocked', 'Notification permission is blocked. Please allow it in your browser settings.');
                }

                import('react-toastify').then(({ toast }) => {
                    toast.error(userFriendlyMsg);
                });
                throw innerError;
            }
        } else if (permission === 'denied') {
            console.warn('Notification permission denied by user.');
            import('react-toastify').then(({ toast }) => {
                toast.info(translate('notificationSetup.permissionDenied', 'Notifications are blocked. Please enable them in your browser settings (icon to the left of the URL).'));
            });
        }
    } catch (error) {
        console.error('An error occurred during notification setup flow:', error);
        if (error.name === 'NotAllowedError') {
            import('react-toastify').then(({ toast }) => {
                toast.error(translate('notificationSetup.notAllowedError', 'Notification settings are restricted in your browser (possibly due to Incognito mode or settings).'));
            });
        } else {
            import('react-toastify').then(({ toast }) => {
                toast.error(translate('notificationSetup.setupFailed', 'Notification setup failed. Please try again later.'));
            });
        }
    }
};


// Handle foreground messages
export const onMessageListener = () =>
    new Promise((resolve) => {
        onMessage(messaging, (payload) => {
            resolve(payload);
        });
    });
