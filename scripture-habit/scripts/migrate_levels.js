import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const db = admin.apps.length ? admin.app().firestore() : (() => {
    // Debug: List available keys (not values)
    const availableKeys = Object.keys(process.env).filter(k => k.includes('FIREBASE') || k.includes('VITE'));
    console.log('Available environment keys:', availableKeys);

    const serviceAccount = {
        project_id: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL || process.env.VITE_FIREBASE_CLIENT_EMAIL,
        private_key: (process.env.FIREBASE_PRIVATE_KEY || process.env.VITE_FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n'),
    };

    if (!serviceAccount.private_key) {
        throw new Error('FIREBASE_PRIVATE_KEY is missing in .env file');
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    return admin.firestore();
})();

async function migrate() {
    console.log('--- Level Migration Started ---');
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();

    console.log(`Found ${snapshot.size} users. Starting calculation...`);

    let processedCount = 0;

    for (const userDoc of snapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();
        const nickname = userData.nickname || 'Unknown';

        // 1. ノートのサブコレクションをクエリ
        const notesRef = db.collection('users').doc(userId).collection('notes');
        const notesSnapshot = await notesRef.get();

        // 2. 日付の重複を除外してカウント (Study Days)
        const studyDays = new Set();
        notesSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.createdAt) {
                // YYYY-MM-DD 形式で保存
                const date = data.createdAt.toDate();
                const dateStr = date.toISOString().split('T')[0];
                studyDays.add(dateStr);
            }
        });

        const finalDaysCount = studyDays.size;

        // 3. daysStudiedCount を更新
        // 同時に totalNotes フィールドもノートの総数と同期させるとより正確です
        await usersRef.doc(userId).update({
            daysStudiedCount: finalDaysCount,
            totalNotes: notesSnapshot.size // 実測値で上書き
        });

        processedCount++;
        console.log(`[${processedCount}/${snapshot.size}] Updated ${nickname}: ${finalDaysCount} days studied.`);
    }

    console.log('--- Migration Completed Successfully ---');
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
