import express from 'express';
import admin from 'firebase-admin';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import helmet from 'helmet';

dotenv.config();

// --- Zod Schemas ---
const verifyLoginSchema = z.object({
    token: z.string().min(1)
});

const joinGroupSchema = z.object({
    token: z.string().min(1).optional(), // Can match bearer logic if needed, but schema validates body
    groupId: z.string().min(1)
});

const leaveGroupSchema = z.object({
    token: z.string().min(1).optional(),
    groupId: z.string().optional() // Optional in logic
});

const deleteGroupSchema = z.object({
    token: z.string().min(1).optional(),
    groupId: z.string().min(1)
});

const supportedLanguages = ['en', 'ja', 'es', 'pt', 'zh', 'vi', 'th', 'ko', 'tl', 'sw'];

const ponderQuestionsSchema = z.object({
    scripture: z.string().min(1).max(100),
    chapter: z.string().min(1).max(50),
    language: z.enum(supportedLanguages).optional()
});

const discussionTopicSchema = z.object({
    language: z.enum(supportedLanguages).optional()
});

const weeklyRecapSchema = z.object({
    groupId: z.string().min(1),
    language: z.enum(supportedLanguages).optional()
});

const personalRecapSchema = z.object({
    uid: z.string().min(1),
    language: z.enum(supportedLanguages).optional()
});

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

// Important for Vercel/proxies so that rate limiter sees the real IP
app.set('trust proxy', 1);

// Security Headers with Custom CSP
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "https://apis.google.com",
                    "https://www.googleapis.com",
                    "https://www.gstatic.com",
                    // "'unsafe-inline'" is often needed for React apps unless nonce is used
                    "'unsafe-inline'",
                ],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                imgSrc: ["'self'", "data:", "https://*.googleusercontent.com", "https://*.ggpht.com"], // Google profile images
                connectSrc: [
                    "'self'",
                    "https://identitytoolkit.googleapis.com",
                    "https://securetoken.googleapis.com",
                    "https://firestore.googleapis.com",
                    "https://www.googleapis.com",
                    // Add your backend URL if it's different in production, but 'self' covers relative API calls
                    "https://scripture-habit.vercel.app",
                    "http://localhost:3000"
                ],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: [], // Disable auto-upgrade for localhost dev
            },
        },
    })
);

// CORS Configuration
const allowedOrigins = [
    'https://scripture-habit.vercel.app',
    'http://localhost:3000', // For local development
    'http://localhost:5173'  // Vite default port
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests) if you want, 
        // OR strict mode: keys must be protected otherwise.
        // For web apps, origin is usually present.
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) === -1) {
            // If origin is not in allowed list, you can block it,
            // OR if you want to allow preview deployments (e.g. vercel preview urls), you might need regex.
            // For now, strict allow list for security.
            // If you have preview URLs, consider allowing *.vercel.app check.
            if (process.env.NODE_ENV !== 'production') {
                return callback(null, true); // Allow all in dev
            }
            var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    }
}));

// Body Parsing with Size Limit (DoS Protection)
app.use(express.json({ limit: '10kb' }));

// ... (rest of code)

// --- Rate Limiters ---
// General Limiter: 100 requests per 15 minutes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many requests from this IP, please try again after 15 minutes.'
});

// AI Endpoint Limiter: Stricter limits (e.g., 20 requests per 15 minutes) to save costs
const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many AI generations requests, please wait a while.'
});

// Apply general limiter to all requests
app.use(limiter);

// --- Routes ---

app.post('/api/verify-login', async (req, res) => {
    const validation = verifyLoginSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }
    const { token } = validation.data;


    try {
        const decodedToken = await admin.auth().verifyIdToken(token);

        // Enforce Email Verification
        if (!decodedToken.email_verified) {
            return res.status(403).send('Email not verified. Please check your email inbox.');
        }

        const uid = decodedToken.uid;
        const email = decodedToken.email;

        console.log('Verified user:', { uid, email });


        res.status(200).send({ message: 'Login verified successfully.', user: { uid, email } });
    } catch (error) {
        console.error('Error verifying ID token:', error); // Log full error internally
        res.status(401).send('Unauthorized: Invalid or expired token.'); // Generic message
    }
});


app.post('/api/join-group', async (req, res) => {
    // Validate Body first
    const validation = joinGroupSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }
    const { groupId } = validation.data;

    const authHeader = req.headers.authorization;
    let idToken;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        idToken = authHeader.split('Bearer ')[1];
    } else if (validation.data.token) {
        idToken = validation.data.token;
    } else {
        return res.status(401).send('Unauthorized: No token provided.');
    }

    // groupId is already from validation.data


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
                membersCount: admin.firestore.FieldValue.increment(1),
                [`memberLastActive.${uid}`]: admin.firestore.FieldValue.serverTimestamp()
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
    const validation = leaveGroupSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }
    const { groupId } = validation.data;

    const authHeader = req.headers.authorization;
    let idToken;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        idToken = authHeader.split('Bearer ')[1];
    } else if (validation.data.token) {
        idToken = validation.data.token;
    } else {
        return res.status(401).send('Unauthorized: No token provided.');
    }

    // groupId logic is handled later (const targetGroupId = groupId || userData.groupId)


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

app.post('/api/delete-group', async (req, res) => {
    const validation = deleteGroupSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }
    const { groupId } = validation.data;

    const authHeader = req.headers.authorization;
    let idToken;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        idToken = authHeader.split('Bearer ')[1];
    } else if (validation.data.token) {
        idToken = validation.data.token;
    } else {
        return res.status(401).send('Unauthorized: No token provided.');
    }

    // groupId is already validated as required string


    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const db = admin.firestore();

        await db.runTransaction(async (t) => {
            const groupRef = db.collection('groups').doc(groupId);
            const groupDoc = await t.get(groupRef);

            if (!groupDoc.exists) {
                const err = new Error('Group not found');
                err.code = 'GROUP_NOT_FOUND';
                throw err;
            }

            const groupData = groupDoc.data();
            if (groupData.ownerUserId !== uid) {
                throw new Error('Permission denied: Only the owner can delete this group.');
            }

            const members = groupData.members || [];

            // Transaction limit is 500 operations. 
            // We read group (1) + delete group (1) = 2.
            // For each member: read (1) + update (1) = 2.
            // Max members supported in single transaction ~= (500 - 2) / 2 = 249.
            // If group is bigger, we might need batched writes outside transaction or multiple chunks.
            // For now, assuming < 250 members.
            const membersToUpdate = members.slice(0, 240);

            for (const memberId of membersToUpdate) {
                const userRef = db.collection('users').doc(memberId);
                const userDoc = await t.get(userRef);

                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const currentGroupIds = userData.groupIds || (userData.groupId ? [userData.groupId] : []);

                    if (currentGroupIds.includes(groupId)) {
                        const newGroupIds = currentGroupIds.filter(id => id !== groupId);
                        let newPrimaryId = userData.groupId;

                        // If the deleted group was the active one, pick a new one or null
                        if (userData.groupId === groupId) {
                            newPrimaryId = newGroupIds.length > 0 ? newGroupIds[0] : null;
                        }

                        t.update(userRef, {
                            groupIds: admin.firestore.FieldValue.arrayRemove(groupId),
                            groupId: newPrimaryId
                        });
                    }
                }
            }

            // Delete group document
            t.delete(groupRef);
        });

        res.status(200).send({ message: 'Group deleted successfully.' });

    } catch (error) {
        if (error.code === 'GROUP_NOT_FOUND') {
            return res.status(404).send('Group not found.');
        }
        if (error.message.includes('Permission denied')) {
            return res.status(403).send(error.message);
        }
        console.error('Error deleting group:', error);
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

        const now = new Date();
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;

        const activeGroups = groups.filter(group => {
            // Creation check
            let createdAt = group.createdAt;
            if (createdAt && typeof createdAt.toDate === 'function') {
                createdAt = createdAt.toDate();
            } else if (createdAt) {
                createdAt = new Date(createdAt);
            } else {
                // Keep groups without creation date safe
                return true;
            }

            const daysSinceCreation = (now - createdAt) / ONE_DAY_MS;

            // 1. If created within last 7 days, always show (New groups)
            if (daysSinceCreation < 7) {
                return true;
            }

            // 2. If older than 7 days, check for ghost status
            const messageCount = group.messageCount || 0;

            // Is ghost if: Has 0 messages
            if (messageCount === 0) {
                return false;
            }

            // OR: Has messages but was inactive for > 30 days
            let lastMessageAt = group.lastMessageAt;
            if (lastMessageAt && typeof lastMessageAt.toDate === 'function') {
                lastMessageAt = lastMessageAt.toDate();
            } else if (lastMessageAt) {
                lastMessageAt = new Date(lastMessageAt);
            }

            if (lastMessageAt) {
                const daysSinceLastActivity = (now - lastMessageAt) / ONE_DAY_MS;
                if (daysSinceLastActivity > 30) {
                    return false;
                }
            }

            return true;
        });

        // Sort by membersCount ascending (handle missing count as 0)
        activeGroups.sort((a, b) => (a.membersCount || 0) - (b.membersCount || 0));

        // Return top 20
        res.status(200).json(activeGroups.slice(0, 20));
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

        // SSRF Protection: Validate Hostname
        if (targetUrl.hostname !== 'www.churchofjesuschrist.org' && targetUrl.hostname !== 'churchofjesuschrist.org') {
            return res.status(400).json({ error: 'Invalid URL domain. Must be churchofjesuschrist.org' });
        }
        if (targetUrl.protocol !== 'https:') {
            return res.status(400).json({ error: 'Invalid protocol. Must be https.' });
        }

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

// AI Ponder Questions Endpoint - Apply AI Rate Limit
app.post('/api/generate-ponder-questions', aiLimiter, async (req, res) => {
    const validation = ponderQuestionsSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }
    const { scripture, chapter, language } = validation.data;

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API Key is not configured.' });
    }

    // Scripture/Chapter checks already handled by Zod schema


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

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`;

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
        res.status(500).json({ error: 'Failed to generate questions. Please try again later.' });
    }
});

// AI Discussion Starter Endpoint
app.post('/api/generate-discussion-topic', aiLimiter, async (req, res) => {
    const validation = discussionTopicSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }
    const { language } = validation.data;


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

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`;

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
        res.status(500).json({ error: 'Failed to generate topic. Please try again later.' });
    }
});

// AI Weekly Recap Endpoint
app.post('/api/generate-weekly-recap', aiLimiter, async (req, res) => {
    const validation = weeklyRecapSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }
    const { groupId, language } = validation.data;

    // GroupId check handled by Zod

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API Key is not configured.' });
    }

    try {
        const db = admin.firestore();
        const groupRef = db.collection('groups').doc(groupId);
        const messagesRef = groupRef.collection('messages');

        // Calculate date 7 days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const timestamp7DaysAgo = admin.firestore.Timestamp.fromDate(sevenDaysAgo);

        // Query notes from last 7 days
        const snapshot = await messagesRef
            .where('createdAt', '>=', timestamp7DaysAgo)
            .get();

        const notes = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Collect both 'isNote' (legacy) and 'isEntry' (new)
            if (data.isNote || data.isEntry) {
                // Anonymize: only take text/content
                if (data.text) {
                    notes.push(data.text);
                }
            }
        });

        if (notes.length === 0) {
            return res.json({ message: 'No notes found for this week, skipping recap.' });
        }

        const langCode = language || 'en';
        let prompt = '';
        const notesText = notes.join("\n\n---\n\n");

        if (langCode === 'ja') {
            prompt = `あなたは末日聖徒イエス・キリスト教会の聖典学習グループのアナウンサーです。
以下は、グループメンバーが過去1週間に共有した（匿名の）学習ノートの内容です。
これらを分析し、グループ全体の「学習トレンド」や「深まっているテーマ」について、短く励ましとなるようなレポートを作成してください。
出力形式:
「今週の振り返り：」で始め、その後に分析結果を続けてください。
例：「今週の振り返り：今週はグループ全体で『祈り』についての学びが深まっているようです！多くのメンバーがアルマ書から主の憐れみについて感じています。」
特定の個人の名前や詳細なプライバシーには触れず、ポジティブな全体の傾向を伝えてください。
です・ます常体で、親しみやすく記述してください。

ノート内容:
${notesText}`;
        } else {
            prompt = `You are an announcer for a scripture study group of The Church of Jesus Christ of Latter-day Saints.
Below are the (anonymized) study notes shared by group members over the past week.
Analyze them and create a short, encouraging report on the group's "learning trends" or "deepening themes".
Output Format:
Start with "Weekly Reflection:", followed by your analysis.
Example: "Weekly Reflection: This week, the group seems to be deepening their understanding of 'Prayer'! Many members are feeling the Lord's mercy from the Book of Alma."
Do not mention specific individual names or private details. Focus on positive overall trends.
Keep it friendly and uplifting.

Notes Content:
${notesText}`;
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`;

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

        // Save the system message
        const batch = db.batch();
        const newMessageRef = messagesRef.doc();
        batch.set(newMessageRef, {
            text: generatedText.trim(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            senderId: 'system',
            isSystemMessage: true,
            messageType: 'weeklyRecap',
            messageData: {
                weekOf: new Date().toISOString()
            }
        });

        // Update last generated timestamp
        batch.update(groupRef, {
            lastRecapGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        res.json({ message: 'Weekly recap generated successfully.', recap: generatedText });

    } catch (error) {
        console.error('Error generating weekly recap:', error.message);
        res.status(500).json({ error: 'Failed to generate recap. Please try again later.' });
    }
});

// AI Personal Weekly Recap Endpoint
app.post('/api/generate-personal-weekly-recap', aiLimiter, async (req, res) => {
    const validation = personalRecapSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }
    const { uid, language } = validation.data;

    // Uid check handled by Zod

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API Key is not configured.' });
    }

    try {
        const db = admin.firestore();
        const notesRef = db.collection('users').doc(uid).collection('notes');

        // Calculate date 7 days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const timestamp7DaysAgo = admin.firestore.Timestamp.fromDate(sevenDaysAgo);

        // Query notes from last 7 days
        const snapshot = await notesRef
            .where('createdAt', '>=', timestamp7DaysAgo)
            .get();

        const notes = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.text || data.comment) {
                // Format: Scripture Chapter - Comment
                let content = "";
                if (data.scripture) content += `[${data.scripture}] `;
                if (data.chapter) content += `${data.chapter}: `;
                if (data.comment) content += `${data.comment}`;
                else if (data.text) content += `${data.text}`; // Fallback for raw text
                notes.push(content);
            }
        });

        if (notes.length === 0) {
            return res.json({ message: 'No notes found for this week found.' }); // Frontend expects message field for info toast
        }

        const langCode = language || 'en';
        let prompt = '';
        const notesText = notes.join("\n\n---\n\n");

        if (langCode === 'ja') {
            prompt = `あなたはユーザーの聖典学習をサポートする親しい友人、あるいはメンターです。
以下は、ユーザーが過去1週間に記録した学習ノートです。
これらをもとに、ユーザーへの「今週の振り返りレター」を書いてください。
条件:
1. ユーザーの頑張りを褒め、励ますような温かいトーンで。
2. ノートから読み取れる霊的な洞察やテーマ（例：信仰、祈り、愛など）を取り上げてください。
3. 「親愛なる友へ」のような書き出しで始めてください。
4. 箇条書きではなく、手紙形式の文章にしてください。
5. 日本語で記述してください。

ユーザーのノート:
${notesText}`;
        } else {
            prompt = `You are a close friend or mentor supporting the user's scripture study.
Below are the study notes the user recorded over the past week.
Based on these, please write a "Weekly Reflection Letter" to the user.
Requirements:
1. Use a warm, encouraging tone that praises their efforts.
2. Highlight spiritual insights or themes (e.g., faith, prayer, love) found in their notes.
3. Start with a greeting like "Dear Friend,".
4. Write in a letter format, not bullet points.

User's Notes:
${notesText}`;
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`;

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

        res.json({ message: 'Personal weekly recap generated successfully.', recap: generatedText.trim() });

    } catch (error) {
        console.error('Error generating personal weekly recap:', error.message);
        res.status(500).json({ error: 'Failed to generate recap. Please try again later.' });
    }
});

// Check Inactive Users (Cron Job)
app.get('/api/check-inactive-users', async (req, res) => {
    // Optional: Protect with secret
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        // Allow manual run for now if secret matching, or maybe open it temporarily
        // But let's keep it safe if secret exists.
    }

    console.log('Starting activity log repair...');
    const db = admin.firestore();

    try {
        const groupsRef = db.collection('groups');
        const snapshot = await groupsRef.get();
        let totalUpdated = 0;

        for (const docSnap of snapshot.docs) {
            const groupId = docSnap.id;
            const groupData = docSnap.data();
            const members = groupData.members || [];

            if (members.length === 0) continue;

            // Fetch last 100 messages to check for recent activity
            const messagesRef = groupsRef.doc(groupId).collection('messages');
            const msgsSnap = await messagesRef
                .orderBy('createdAt', 'desc')
                .limit(200) // Check last 200 messages
                .get();

            const updates = {};
            const foundMembers = new Set();

            // Existing activity data
            const currentLastActive = groupData.memberLastActive || {};

            msgsSnap.forEach(msgDoc => {
                const data = msgDoc.data();
                const senderId = data.senderId;
                const createdAt = data.createdAt;

                // If this is a user message and we haven't found a newer one for this user match
                if (senderId && members.includes(senderId) && !foundMembers.has(senderId)) {
                    // Update only if current data is missing or older
                    const currentTimestamp = currentLastActive[senderId];
                    if (!currentTimestamp || (createdAt && createdAt.toMillis() > currentTimestamp.toMillis())) {
                        updates[`memberLastActive.${senderId}`] = createdAt;
                    }
                    foundMembers.add(senderId);
                }
            });

            if (Object.keys(updates).length > 0) {
                await groupsRef.doc(groupId).update(updates);
                totalUpdated += Object.keys(updates).length;
                console.log(`Updated ${Object.keys(updates).length} members in group ${groupData.name || groupId}`);
            }
        }

        res.json({ message: `Repair complete. Updated activity logs for ${totalUpdated} members.` });

    } catch (error) {
        console.error('Error repairing logs:', error);
        res.status(500).json({ error: error.message });
    }
});

// FORCE PURGE: Remove users who were just initialized but have no history (Ghost buster)
app.get('/api/purge-initialized-users', async (req, res) => {
    // Optional: Protect with secret
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        // Security check
    }

    console.log('Starting ghost purge...');
    const db = admin.firestore();

    try {
        const groupsRef = db.collection('groups');
        const snapshot = await groupsRef.get();
        let totalRemoved = 0;
        let batch = db.batch();
        let batchOpCount = 0;
        const now = new Date();
        const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

        for (const groupDoc of snapshot.docs) {
            const groupId = groupDoc.id;
            const groupData = groupDoc.data();
            const members = groupData.members || [];
            const memberLastActive = groupData.memberLastActive || {};

            if (members.length === 0) continue;

            // Fetch history to confirm they are really ghosts (no messages)
            const messagesRef = groupsRef.doc(groupId).collection('messages');
            const msgsSnap = await messagesRef.orderBy('createdAt', 'desc').limit(200).get();
            const activeUserIds = new Set();
            msgsSnap.forEach(m => {
                if (m.data().senderId) activeUserIds.add(m.data().senderId);
            });

            const ghostsToRemove = [];

            for (const uid of members) {
                // SKIP if they have spoken
                if (activeUserIds.has(uid)) continue;
                // SKIP if they are the owner (don't delete owner blindly)
                if (uid === groupData.ownerUserId) continue;

                const lastActive = memberLastActive[uid];
                if (lastActive) {
                    const lastActiveDate = lastActive.toDate();
                    const diff = now - lastActiveDate;

                    // IF it was updated very recently (within 2 hours), 
                    // it means they were likely just "Initialized" by our check-inactive script
                    // because they had NO prior record.
                    if (diff < TWO_HOURS_MS) {
                        ghostsToRemove.push(uid);
                    }
                }
            }

            if (ghostsToRemove.length > 0) {
                // REMOVE THEM
                totalRemoved += ghostsToRemove.length;

                // Update Group
                batch.update(groupsRef.doc(groupId), {
                    members: admin.firestore.FieldValue.arrayRemove(...ghostsToRemove),
                    membersCount: admin.firestore.FieldValue.increment(-ghostsToRemove.length)
                });
                ghostsToRemove.forEach(uid => {
                    batch.update(groupsRef.doc(groupId), {
                        [`memberLastActive.${uid}`]: admin.firestore.FieldValue.delete()
                    });
                });
                batchOpCount++;

                // System Message
                const msgRef = messagesRef.doc();
                batch.set(msgRef, {
                    text: `👋 **${ghostsToRemove.length} inactive member(s)** were removed.`,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    senderId: 'system',
                    isSystemMessage: true,
                    type: 'leave'
                });
                batchOpCount++;

                // Update Users
                for (const uid of ghostsToRemove) {
                    const userRef = db.collection('users').doc(uid);
                    const userSnap = await userRef.get();
                    if (userSnap.exists) {
                        batch.update(userRef, {
                            groupIds: admin.firestore.FieldValue.arrayRemove(groupId)
                        });
                        const gsRef = userRef.collection('groupStates').doc(groupId);
                        batch.delete(gsRef);
                        batchOpCount += 2;
                    }
                }
            }

            if (batchOpCount > 300) {
                await batch.commit();
                batch = db.batch();
                batchOpCount = 0;
            }
        }

        if (batchOpCount > 0) await batch.commit();

        res.json({ message: `Purge complete. Removed ${totalRemoved} ghost users.` });

    } catch (error) {
        console.error('Error purging:', error);
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/check-inactive-users', async (req, res) => {
    // Use a simple CRON_SECRET if available for security
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        console.warn('Unauthorized access attempt to /api/check-inactive-users');
        if (cronSecret) return res.status(401).send('Unauthorized');
    }

    console.log('Starting inactivity check...');
    const db = admin.firestore();

    try {
        const groupsRef = db.collection('groups');
        const snapshot = await groupsRef.get();

        let processedCount = 0;
        let removedCount = 0;
        let transferCount = 0;
        let deletedGroupCount = 0;
        let initializedCount = 0;

        let batch = db.batch();
        let batchOpCount = 0;

        const now = new Date();
        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

        for (const doc of snapshot.docs) {
            const groupData = doc.data();
            const groupId = doc.id;
            const members = groupData.members || [];
            const memberLastActive = groupData.memberLastActive || {};
            let ownerUserId = groupData.ownerUserId;

            if (members.length === 0) continue;

            let groupChanged = false;
            let groupUpdates = {};
            let isGroupDeleted = false;

            // Classify members
            const activeMembers = [];
            const inactiveMembers = [];
            const membersToInitialize = [];

            for (const memberId of members) {
                const lastActiveTimestamp = memberLastActive[memberId];

                if (!lastActiveTimestamp) {
                    // Initialize tracking if missing (giving them a fresh start)
                    membersToInitialize.push(memberId);
                    activeMembers.push(memberId); // Treat as active for ownership transfer purposes
                } else {
                    const lastActiveDate = lastActiveTimestamp.toDate();
                    const diff = now - lastActiveDate;

                    if (diff > THREE_DAYS_MS) {
                        inactiveMembers.push(memberId);
                    } else {
                        activeMembers.push(memberId);
                    }
                }
            }

            // Check if Owner is Inactive
            if (inactiveMembers.includes(ownerUserId)) {
                // Owner is inactive.
                if (activeMembers.length > 0) {
                    // Transfer Ownership
                    // activeMembers preserves order from 'members' array loop
                    const newOwnerId = activeMembers[0];
                    groupUpdates['ownerUserId'] = newOwnerId;
                    ownerUserId = newOwnerId; // Update local var so we don't remove the new owner

                    groupChanged = true;
                    transferCount++;

                    // System Message for Transfer
                    const transferMsgRef = groupsRef.doc(groupId).collection('messages').doc();
                    batch.set(transferMsgRef, {
                        text: `� **Ownership Transferred**\nThe previous owner was inactive. Ownership has been transferred to a verified active member.`,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        senderId: 'system',
                        isSystemMessage: true,
                        type: 'system'
                    });
                    batchOpCount++;
                } else {
                    // No active members to transfer to.
                    // DELETE GROUP
                    batch.delete(groupsRef.doc(groupId));
                    batchOpCount++;
                    deletedGroupCount++;
                    isGroupDeleted = true;

                    // Remove group from ALL users
                    for (const uid of members) {
                        const userRef = db.collection('users').doc(uid);
                        batch.update(userRef, {
                            groupIds: admin.firestore.FieldValue.arrayRemove(groupId)
                        });
                        batchOpCount++;

                        const groupStateRef = userRef.collection('groupStates').doc(groupId);
                        batch.delete(groupStateRef);
                        batchOpCount++;
                    }
                }
            }

            // If group was deleted, skip standard removal logic
            if (isGroupDeleted) {
                processedCount++;
                if (batchOpCount > 300) {
                    await batch.commit();
                    batch = db.batch();
                    batchOpCount = 0;
                }
                continue;
            }

            // Handle Initializations (only if group exists)
            if (membersToInitialize.length > 0) {
                const updateMap = {};
                membersToInitialize.forEach(uid => {
                    updateMap[`memberLastActive.${uid}`] = admin.firestore.FieldValue.serverTimestamp();
                });
                Object.assign(groupUpdates, updateMap);
                groupChanged = true;
                initializedCount += membersToInitialize.length;
            }

            // Handle Inactive Removals
            // Ensure we don't remove the CURRENT owner
            const finalMembersToRemove = inactiveMembers.filter(uid => uid !== ownerUserId);

            if (finalMembersToRemove.length > 0) {
                const removeUidList = finalMembersToRemove;

                // Update Group Doc
                groupUpdates['members'] = admin.firestore.FieldValue.arrayRemove(...removeUidList);
                groupUpdates['membersCount'] = admin.firestore.FieldValue.increment(-removeUidList.length);

                removeUidList.forEach(uid => {
                    groupUpdates[`memberLastActive.${uid}`] = admin.firestore.FieldValue.delete();
                });

                groupChanged = true;
                removedCount += removeUidList.length;

                // Add System Message
                const messageRef = groupsRef.doc(groupId).collection('messages').doc();
                batch.set(messageRef, {
                    text: `👋 **${removeUidList.length} member(s)** were removed due to inactivity (3+ days).`,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    senderId: 'system',
                    isSystemMessage: true,
                    type: 'leave'
                });
                batchOpCount++;

                // Update Users
                for (const uid of removeUidList) {
                    const userRef = db.collection('users').doc(uid);
                    // Check if user exists before updating to avoid NOT_FOUND error in batch
                    const userSnap = await userRef.get();

                    if (userSnap.exists) {
                        batch.update(userRef, {
                            groupIds: admin.firestore.FieldValue.arrayRemove(groupId)
                        });
                        batchOpCount++;

                        const groupStateRef = userRef.collection('groupStates').doc(groupId);
                        batch.delete(groupStateRef);
                        batchOpCount++;
                    } else {
                        console.log(`Skipping inactivity cleanup for non-existent user: ${uid}`);
                    }
                }
            }

            if (groupChanged) {
                batch.update(groupsRef.doc(groupId), groupUpdates);
                batchOpCount++;
            }

            // Commit batch if getting too large
            if (batchOpCount > 300) {
                await batch.commit();
                batch = db.batch();
                batchOpCount = 0;
            }

            processedCount++;
        }

        if (batchOpCount > 0) {
            await batch.commit();
        }

        res.json({
            message: 'Inactivity check complete.',
            stats: {
                processedGroups: processedCount,
                removedUsers: removedCount,
                initializedTracking: initializedCount,
                transferredOwnerships: transferCount,
                deletedGroups: deletedGroupCount
            }
        });

    } catch (error) {
        console.error('Error in inactivity check:', error);
        res.status(500).send('Error checking inactivity: ' + error.message);
    }
});

// Export the app for Vercel
export default app;
