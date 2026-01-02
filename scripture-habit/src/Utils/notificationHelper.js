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

export const requestNotificationPermission = async (userId) => {
    // 1. Check basic support
    if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) {
        console.warn('Push notifications are not supported in this browser.');
        import('react-toastify').then(({ toast }) => {
            toast.warn('お使いのブラウザは通知機能をサポートしていません。最新のChromeやSafariでお試しください。');
        });
        return;
    }

    // 2. Check for In-App Browsers
    if (isInAppBrowser()) {
        console.warn('Push notifications often fail in In-App Browsers.');
        import('react-toastify').then(({ toast }) => {
            toast.info('アプリ内ブラウザでは通知が届かない場合があります。右下のボタンからブラウザ（ChromeやSafari）で開き直してください。');
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

                // Instead of aggressive unregistration, let's try to get existing or register fresh
                const existingRegs = await navigator.serviceWorker.getRegistrations();
                const ourReg = existingRegs.find(r => r.scope.includes(window.location.host));

                if (ourReg) {
                    console.log('Using existing SW registration:', ourReg.scope);
                    registration = ourReg;
                    // Optionally update it
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

                // 5. Check if active - if not, wait a bit
                if (!registration.active && !registration.installing && !registration.waiting) {
                    console.error('Service worker registration failed to find an active worker.');
                    throw new Error('Service Worker not active after registration');
                }

                // 6. Get FCM token
                // Note: getToken can still throw if the browser is in Incognito or has storage blocked
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
                        toast.success('通知設定が完了しました！ 🎉');
                    });
                    return token;
                } else {
                    console.log('No FCM token received.');
                    throw new Error('No registration token available');
                }
            } catch (innerError) {
                console.error('Detailed error during SW/Token process:', innerError);

                // Specific messaging for known errors
                let userFriendlyMsg = '通知の設定中にエラーが発生しました。';
                if (innerError.name === 'NotAllowedError') {
                    userFriendlyMsg = 'ブラウザの設定により、サービスワーカーの登録が拒否されました。シークレットモードを解除するか、設定を確認してください。';
                } else if (innerError.code === 'messaging/permission-blocked') {
                    userFriendlyMsg = '通知の権限がブロックされています。ブラウザの設定から許可してください。';
                }

                import('react-toastify').then(({ toast }) => {
                    toast.error(userFriendlyMsg);
                });
                throw innerError;
            }
        } else if (permission === 'denied') {
            console.warn('Notification permission denied by user.');
            import('react-toastify').then(({ toast }) => {
                toast.info('通知がブロックされています。ブラウザの設定（URLの左のアイコンなど）から許可をオンにしてください。');
            });
        }
    } catch (error) {
        console.error('An error occurred during notification setup flow:', error);
        if (error.name === 'NotAllowedError') {
            import('react-toastify').then(({ toast }) => {
                toast.error('ブラウザで通知設定が制限されています（シークレットモードや、設定による制限の可能性があります）。');
            });
        } else {
            import('react-toastify').then(({ toast }) => {
                toast.error('通知の設定に失敗しました。後でもう一度お試しください。');
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
