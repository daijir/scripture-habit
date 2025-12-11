import express from 'express';
import admin from 'firebase-admin';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';

dotenv.config();

// Initialize Firebase Admin SDK
// Check if already initialized to avoid "default app already exists" error in serverless environment
if (!admin.apps.length) {
    // Construct service account from environment variables
    const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
    };

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const app = express();

// Allow CORS from anywhere (or restrict to your Vercel app domain in production)
app.use(cors({ origin: true }));
app.use(express.json());

// --- Routes ---

app.post('/api/verify-login', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).send('ID token is required.');
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const uid = decodedToken.uid;
        const email = decodedToken.email;

        console.log('Verified user:', { uid, email });

        res.status(200).send({ message: 'Login verified successfully.', user: { uid, email } });
    } catch (error) {
        console.error('Error verifying ID token:', error);
        res.status(401).send('Unauthorized: Invalid ID token.');
    }
});


app.post('/api/join-group', async (req, res) => {
    const authHeader = req.headers.authorization;
    let idToken;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        idToken = authHeader.split('Bearer ')[1];
    } else if (req.body.token) {
        idToken = req.body.token;
    } else {
        return res.status(401).send('Unauthorized: No token provided.');
    }

    const { groupId } = req.body;
    if (!groupId) return res.status(400).send('Group ID is required.');

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const db = admin.firestore();

        await db.runTransaction(async (t) => {
            const userRef = db.collection('users').doc(uid);
            const groupRef = db.collection('groups').doc(groupId);

            const userDoc = await t.get(userRef);
            const groupDoc = await t.get(groupRef);

            if (!groupDoc.exists) throw new Error('Group not found.');

            const userData = userDoc.data();
            const groupIds = userData.groupIds || (userData.groupId ? [userData.groupId] : []);

            if (groupIds.includes(groupId)) throw new Error('User already in this group.');
            if (groupIds.length >= 7) throw new Error('You can only join up to 12 groups.');

            const groupData = groupDoc.data();
            if (groupData.members && groupData.members.includes(uid)) throw new Error('User already in this group.');
            if (groupData.membersCount >= groupData.maxMembers) throw new Error('Group is full.');

            t.update(groupRef, {
                members: admin.firestore.FieldValue.arrayUnion(uid),
                membersCount: admin.firestore.FieldValue.increment(1)
            });

            // Update user's groupIds and set groupId to the new one (as "active" or "primary" for backward compatibility if needed, 
            // but ideally we rely on groupIds). We'll keep groupId as the "last joined" or "primary" for now to avoid breaking other things immediately.
            t.update(userRef, {
                groupIds: admin.firestore.FieldValue.arrayUnion(groupId),
                groupId: groupId
            });

            // Add system message
            const messagesRef = groupRef.collection('messages').doc();
            t.set(messagesRef, {
                text: `👋 **${userData.nickname || 'A user'}** joined the group!`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                senderId: 'system',
                isSystemMessage: true,
                messageType: 'userJoined',
                messageData: {
                    nickname: userData.nickname || 'A user'
                }
            });
        });

        res.status(200).send({ message: 'Successfully joined group.' });
    } catch (error) {
        console.error('Error joining group:', error);
        res.status(500).send(error.message || 'Internal Server Error');
    }
});


app.post('/api/leave-group', async (req, res) => {
    const authHeader = req.headers.authorization;
    let idToken;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        idToken = authHeader.split('Bearer ')[1];
    } else if (req.body.token) {
        idToken = req.body.token;
    } else {
        return res.status(401).send('Unauthorized: No token provided.');
    }

    const { groupId } = req.body;

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const db = admin.firestore();

        await db.runTransaction(async (t) => {
            const userRef = db.collection('users').doc(uid);
            const userDoc = await t.get(userRef);

            if (!userDoc.exists) throw new Error('User not found.');
            const userData = userDoc.data();

            // Determine which group to leave
            const targetGroupId = groupId || userData.groupId;
            if (!targetGroupId) throw new Error('No group specified to leave.');

            const groupRef = db.collection('groups').doc(targetGroupId);
            const groupDoc = await t.get(groupRef);

            if (groupDoc.exists) {
                t.update(groupRef, {
                    members: admin.firestore.FieldValue.arrayRemove(uid),
                    membersCount: admin.firestore.FieldValue.increment(-1)
                });
            }

            // Update user data
            // Remove from groupIds
            // If the left group was the 'groupId' (primary), we should probably pick another one or set to null.

            const currentGroupIds = userData.groupIds || (userData.groupId ? [userData.groupId] : []);
            const newGroupIds = currentGroupIds.filter(id => id !== targetGroupId);

            let newPrimaryGroupId = userData.groupId;
            if (userData.groupId === targetGroupId) {
                newPrimaryGroupId = newGroupIds.length > 0 ? newGroupIds[0] : null;
            }

            t.update(userRef, {
                groupIds: admin.firestore.FieldValue.arrayRemove(targetGroupId),
                groupId: newPrimaryGroupId
            });

            // Add system message
            if (groupDoc.exists) {
                const messagesRef = groupRef.collection('messages').doc();
                t.set(messagesRef, {
                    text: `🚪 **${userData.nickname || 'A user'}** left the group.`,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    senderId: 'system',
                    isSystemMessage: true,
                    messageType: 'userLeft',
                    messageData: {
                        nickname: userData.nickname || 'A user'
                    }
                });
            }
        });

        res.status(200).send({ message: 'Successfully left group.' });
    } catch (error) {
        console.error('Error leaving group:', error);
        res.status(500).send(error.message || 'Internal Server Error');
    }
});


app.get('/api/groups', async (req, res) => {
    try {
        const db = admin.firestore();
        const groupsRef = db.collection('groups');

        // Fetch all public groups (without orderBy/limit to avoid index issues/missing fields)
        const snapshot = await groupsRef
            .where('isPublic', '==', true)
            .get();

        const groups = [];
        snapshot.forEach(doc => {
            groups.push({ id: doc.id, ...doc.data() });
        });

        // Sort by membersCount ascending (handle missing count as 0)
        groups.sort((a, b) => (a.membersCount || 0) - (b.membersCount || 0));

        // Return top 20
        res.status(200).json(groups.slice(0, 20));
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).send('Error fetching groups.');
    }
});

// Scraping Endpoint for General Conference Metadata
app.get('/api/fetch-gc-metadata', async (req, res) => {
    const { url, lang } = req.query;

    if (!url) return res.status(400).send({ error: 'URL is required' });

    try {
        const targetUrl = new URL(url);
        if (lang) {
            targetUrl.searchParams.set('lang', lang);
        }

        const response = await axios.get(targetUrl.toString(), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);

        // Attempt to find title
        let title = $('h1').first().text().trim();

        // Attempt to find speaker
        let speaker = '';
        // Common selectors for GC talks
        if ($('div.byline p.author-name').length) {
            speaker = $('div.byline p.author-name').first().text().trim();
        } else if ($('p.author-name').length) {
            speaker = $('p.author-name').first().text().trim();
        } else if ($('a.author-name').length) {
            speaker = $('a.author-name').first().text().trim();
        } else if ($('.speaker-name').length) {
            speaker = $('.speaker-name').text().trim();
        }

        res.json({ title, speaker });
    } catch (error) {
        console.error('Error scraping GC:', error.message);
        res.status(500).json({ error: 'Failed to fetch metadata' });
    }
});

// AI Ponder Questions Endpoint
app.post('/api/generate-ponder-questions', async (req, res) => {
    const { scripture, chapter, language } = req.body;

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API Key is not configured.' });
    }

    if (!scripture || !chapter) {
        return res.status(400).json({ error: 'Scripture and chapter are required.' });
    }

    try {
        const langCode = language || 'en';
        let prompt = '';

        if (langCode === 'ja') {
            prompt = `あなたは末日聖徒イエス・キリスト教会の「わたしに従ってきなさい」の学習ガイドです。
ユーザーが「${scripture} ${chapter}」を読んでいます。
この章について、深く考えるための質問（Ponder Question）を1つだけ提案してください。
箇条書きの記号（*や-など）は使わず、質問文のみをプレーンテキストで出力してください。
霊的な洞察を促す、心に響く質問にしてください。`;
        } else {
            prompt = `You are a "Come, Follow Me" study guide for The Church of Jesus Christ of Latter-day Saints.
The user is reading "${scripture} ${chapter}".
Please suggest 1 Ponder Question to help them think deeply about this chapter.
Do NOT use bullet points or markdown (*, -). Output only the question text.
Make it spiritually thought-provoking.`;
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`;

        const response = await axios.post(apiUrl, {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        });

        const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            throw new Error('No content generated from Gemini.');
        }

        res.json({ questions: generatedText });

    } catch (error) {
        console.error('Error generating AI questions:', error.message);
        if (error.response) {
            console.error('Gemini API Error:', error.response.data);
        }
        res.status(500).json({ error: 'Failed to generate questions.' });
    }
});

// AI Discussion Starter Endpoint
app.post('/api/generate-discussion-topic', async (req, res) => {
    const { language } = req.body;

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API Key is not configured.' });
    }

    try {
        const langCode = language || 'en';
        let prompt = '';

        if (langCode === 'ja') {
            prompt = `あなたは末日聖徒イエス・キリスト教会の聖典学習グループのファシリテーターです。
グループのメンバーが互いの経験や証を分かち合いたくなるような、話し合いのきっかけとなる質問を1つだけ提案してください。
特定の聖句に限定せず、「今週の学習で」「最近の生活で」といった幅広い文脈で、しかし霊的な深まりをもたらす質問にしてください。
例：「今週、主の助けを感じた瞬間はありましたか？」など。
箇条書きの記号（*や-など）は使わず、質問文のみをプレーンテキストで出力してください。`;
        } else {
            prompt = `You are a facilitator for a scripture study group of The Church of Jesus Christ of Latter-day Saints.
Please suggest 1 discussion starter question that encourages members to share their experiences and testimonies.
Make the question broad enough (e.g., "In your study this week...", "In your life recently...") but spiritually meaningful.
Do NOT use bullet points or markdown (*, -). Output only the question text.`;
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`;

        const response = await axios.post(apiUrl, {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        });

        const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            throw new Error('No content generated from Gemini.');
        }

        res.json({ topic: generatedText.trim() });

    } catch (error) {
        console.error('Error generating discussion topic:', error.message);
        res.status(500).json({ error: 'Failed to generate topic.' });
    }
});

// Export the app for Vercel
export default app;
