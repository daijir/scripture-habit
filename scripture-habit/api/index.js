import express from 'express';
import crypto from 'crypto';
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

const supportedLanguages = ['en', 'ja', 'es', 'pt', 'zh', 'zho', 'vi', 'th', 'ko', 'tl', 'sw'];

const ponderQuestionsSchema = z.object({
    scripture: z.string().min(1).max(100),
    chapter: z.string().min(1).max(50),
    language: z.enum(supportedLanguages).optional()
});

const discussionTopicSchema = z.object({
    language: z.enum(supportedLanguages).optional()
});

const STREAK_ANNOUNCEMENT_TEMPLATES = {
    en: "🎉🎉🎉 **{nickname} reached a {streak} day streak!!** 🎉🎉🎉",
    ja: "🎉🎉🎉 **{nickname}さんが{streak}日連続達成しました！！** 🎉🎉🎉",
    es: "🎉🎉🎉 **¡{nickname} alcanzó una racha de {streak} días!** 🎉🎉🎉",
    pt: "🎉🎉🎉 **{nickname} atingiu uma sequência de {streak} dias!!** 🎉🎉🎉",
    zh: "🎉🎉🎉 **{nickname} 已連讀 {streak} 天！！** 🎉🎉🎉",
    zho: "🎉🎉🎉 **{nickname} 已連讀 {streak} 天！！** 🎉🎉🎉",
    vi: "🎉🎉🎉 **{nickname} đã đạt chuỗi {streak} ngày!!** 🎉🎉🎉",
    th: "🎉🎉🎉 **{nickname} บรรลุสถิติต่อเนื่อง {streak} วัน!!** 🎉🎉🎉",
    ko: "🎉🎉🎉 **{nickname}님이 {streak}일 연속 달성했습니다!!** 🎉🎉🎉",
    tl: "🎉🎉🎉 **Naabot ni {nickname} ang {streak} na araw na streak!!** 🎉🎉🎉",
    sw: "🎉🎉🎉 **{nickname} amefikisha mfululizo wa siku {streak}!!** 🎉🎉🎉"
};

const weeklyRecapSchema = z.object({
    groupId: z.string().min(1),
    language: z.enum(supportedLanguages).optional()
});

const personalRecapSchema = z.object({
    uid: z.string().min(1),
    language: z.enum(supportedLanguages).optional()
});

const translateSchema = z.object({
    text: z.string().min(1).max(5000),
    targetLanguage: z.enum(supportedLanguages)
});

const postNoteSchema = z.object({
    chapter: z.string().min(1).max(500),
    scripture: z.string().min(1).max(100),
    comment: z.string().max(10000),
    shareOption: z.enum(['all', 'current', 'specific', 'none']),
    selectedShareGroups: z.array(z.string()).optional().nullable(),
    isGroupContext: z.boolean().optional().nullable(),
    currentGroupId: z.string().optional().nullable(),
    language: z.enum(supportedLanguages).optional().nullable()
});

const postMessageSchema = z.object({
    groupId: z.string().min(1),
    text: z.string().min(1).max(5000),
    replyTo: z.object({
        id: z.string(),
        senderNickname: z.string(),
        text: z.string(),
        isNote: z.boolean().optional()
    }).optional().nullable()
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

const db = admin.firestore();
const messaging = admin.messaging();

async function sendPushNotification(tokens, payload) {
    if (!tokens || tokens.length === 0) return { successCount: 0, failureCount: 0, failedTokens: [] };

    const uniqueTokens = [...new Set(tokens)];
    const failedTokens = [];
    let totalSuccess = 0;
    let totalFailure = 0;

    // FCM multicast limit is 500 tokens per request
    const CHUNK_SIZE = 500;
    for (let i = 0; i < uniqueTokens.length; i += CHUNK_SIZE) {
        const chunk = uniqueTokens.slice(i, i + CHUNK_SIZE);
        const message = {
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: payload.data || {},
            tokens: chunk,
        };

        try {
            const response = await messaging.sendEachForMulticast(message);
            totalSuccess += response.successCount;
            totalFailure += response.failureCount;

            if (response.failureCount > 0) {
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        const error = resp.error;
                        // Track tokens that are definitely invalid/expired
                        if (error && (
                            error.code === 'messaging/invalid-registration-token' ||
                            error.code === 'messaging/registration-token-not-registered'
                        )) {
                            failedTokens.push(chunk[idx]);
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error sending push notification chunk:', error);
        }
    }

    return {
        successCount: totalSuccess,
        failureCount: totalFailure,
        failedTokens
    };
}

async function notifyGroupMembers(groupId, senderUid, payload) {
    try {
        const groupDoc = await db.collection('groups').doc(groupId).get();
        if (!groupDoc.exists) return;

        const groupData = groupDoc.data();
        const members = groupData.members || [];
        const membersToNotifyIds = members.filter(uid => uid !== senderUid);

        if (membersToNotifyIds.length === 0) return;

        // Optimized Read: Get all member documents in one call
        const memberRefs = membersToNotifyIds.map(uid => db.collection('users').doc(uid));
        const memberDocs = await db.getAll(...memberRefs);

        const tokens = [];
        const tokenToUserMap = new Map(); // To track which token belongs to which user for cleanup

        memberDocs.forEach((uDoc, idx) => {
            if (uDoc.exists) {
                const userData = uDoc.data();
                const uid = membersToNotifyIds[idx];
                if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
                    userData.fcmTokens.forEach(t => {
                        tokens.push(t);
                        tokenToUserMap.set(t, uid);
                    });
                }
            }
        });

        if (tokens.length > 0) {
            const result = await sendPushNotification(tokens, payload);

            // Automatic Cleanup of Invalid Tokens
            if (result.failedTokens && result.failedTokens.length > 0) {
                console.log(`Cleaning up ${result.failedTokens.length} invalid tokens...`);
                const batch = db.batch();
                let opCount = 0;

                result.failedTokens.forEach(t => {
                    const uid = tokenToUserMap.get(t);
                    if (uid) {
                        const userRef = db.collection('users').doc(uid);
                        batch.update(userRef, {
                            fcmTokens: admin.firestore.FieldValue.arrayRemove(t)
                        });
                        opCount++;
                    }
                });

                if (opCount > 0) {
                    await batch.commit();
                }
            }
        }
    } catch (error) {
        console.error('Error in notifyGroupMembers:', error);
    }
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
                    "https://scripturehabit.app",
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
    'https://scripturehabit.app',
    'http://localhost:3000', // For local development
    'http://localhost:5173',  // Vite default port
    'https://localhost',      // Android Capacitor
    'capacitor://localhost',  // iOS Capacitor
    'http://localhost'        // Android Capacitor (http)
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

        const groupRef = db.collection('groups').doc(groupId);

        // 1. Optimized Transaction: verify ownership and delete group doc
        const membersToClean = await db.runTransaction(async (t) => {
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

            // Update owner doc specifically to set new primary group if needed
            const ownerRef = db.collection('users').doc(uid);
            const ownerDoc = await t.get(ownerRef);
            if (ownerDoc.exists) {
                const uData = ownerDoc.data();
                const currentGroupIds = uData.groupIds || (uData.groupId ? [uData.groupId] : []);
                const nextGroupIds = currentGroupIds.filter(id => id !== groupId);

                let upd = { groupIds: admin.firestore.FieldValue.arrayRemove(groupId) };
                if (uData.groupId === groupId) {
                    upd.groupId = nextGroupIds.length > 0 ? nextGroupIds[0] : null;
                }
                t.update(ownerRef, upd);
            }

            // Delete the main group document
            t.delete(groupRef);

            return groupData.members || [];
        });

        // 2. Cleanup other members in background-safe batches
        if (membersToClean.length > 0) {
            const chunks = [];
            for (let i = 0; i < membersToClean.length; i += 450) {
                chunks.push(membersToClean.slice(i, i + 450));
            }

            for (const chunk of chunks) {
                const batch = db.batch();
                chunk.forEach(mid => {
                    if (mid === uid) return; // Already handled in transaction
                    const mRef = db.collection('users').doc(mid);
                    batch.update(mRef, {
                        groupIds: admin.firestore.FieldValue.arrayRemove(groupId)
                    });
                });
                try {
                    await batch.commit();
                } catch (batchErr) {
                    console.error('Member cleanup partial error:', batchErr);
                }
            }
        }

        // 3. Recursive delete subcollections (messages, etc.)
        await db.recursiveDelete(groupRef);

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

        // Fetch up to 100 public groups to avoid quota issues and performance degradation
        // Sorting by lastMessageAt to get currently active groups first
        const snapshot = await groupsRef
            .where('isPublic', '==', true)
            .orderBy('lastMessageAt', 'desc')
            .limit(100)
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
app.post('/api/post-note', async (req, res) => {
    const validation = postNoteSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }

    const { chapter, scripture, comment, shareOption, selectedShareGroups, isGroupContext, currentGroupId, language } = validation.data;

    const authHeader = req.headers.authorization;
    let idToken;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        idToken = authHeader.split('Bearer ')[1];
    } else {
        return res.status(401).send('Unauthorized: No token provided.');
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const db = admin.firestore();

        let messageText;
        if (scripture === "Other") {
            messageText = `📖 **New Study Note**\n\n**Scripture:** ${scripture}\n\n${comment}`;
        } else {
            let label = (scripture === "BYU Speeches") ? "Speech" : "Chapter";
            messageText = `📖 **New Study Note**\n\n**Scripture:** ${scripture}\n\n**${label}:** ${chapter}\n\n${comment}`;
        }

        const result = await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(uid);
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw new Error('User not found.');
            const userData = userDoc.data();

            // 1. Streak and Stats Logic
            const timeZone = userData.timeZone || 'UTC';
            const now = new Date();
            const todayStr = now.toLocaleDateString('en-CA', { timeZone });
            let lastPostDate = null;
            if (userData.lastPostDate) {
                lastPostDate = userData.lastPostDate.toDate ? userData.lastPostDate.toDate() : new Date(userData.lastPostDate);
            }

            let newStreak = userData.streakCount || 0;
            let streakUpdated = false;

            if (!lastPostDate) {
                newStreak = 1;
                streakUpdated = true;
            } else {
                const lastPostDateStr = lastPostDate.toLocaleDateString('en-CA', { timeZone });
                if (todayStr !== lastPostDateStr) {
                    const todayDate = new Date(todayStr);
                    const lastPostDateObj = new Date(lastPostDateStr);
                    const diffTime = todayDate - lastPostDateObj;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays === 1) {
                        newStreak += 1;
                    } else {
                        newStreak = 1;
                    }
                    streakUpdated = true;
                } else if (newStreak === 0) {
                    newStreak = 1;
                    streakUpdated = true;
                }
            }

            const userUpdate = {
                lastPostDate: admin.firestore.FieldValue.serverTimestamp(),
                totalNotes: admin.firestore.FieldValue.increment(1)
            };
            if (streakUpdated) {
                userUpdate.streakCount = newStreak;
                userUpdate.daysStudiedCount = admin.firestore.FieldValue.increment(1);
            }

            // 2. Determine target groups
            let groupsToPostTo = [];
            if (shareOption === 'all') {
                groupsToPostTo = userData.groupIds || (userData.groupId ? [userData.groupId] : []);
            } else if (shareOption === 'specific') {
                groupsToPostTo = selectedShareGroups || [];
            } else if (shareOption === 'current') {
                const targetId = currentGroupId || userData.groupId;
                if (targetId) groupsToPostTo = [targetId];
            }

            // 3. READ ALL NECESSARY DATA FIRST
            const groupRefs = groupsToPostTo.map(gid => db.collection('groups').doc(gid));
            const groupDocs = await Promise.all(groupRefs.map(ref => transaction.get(ref)));

            // 4. NOW START WRITES
            transaction.update(userRef, userUpdate);

            // 3. Create Personal Note
            const personalNoteRef = userRef.collection('notes').doc();
            const noteTimestamp = admin.firestore.Timestamp.now();
            const sharedMessageIds = {};

            // 5. Post to groups and update metadata

            groupDocs.forEach((groupDoc, idx) => {
                if (!groupDoc.exists) return;
                const gid = groupDoc.id;
                const gData = groupDoc.data();
                const msgRef = db.collection('groups').doc(gid).collection('messages').doc();
                sharedMessageIds[gid] = msgRef.id;

                transaction.set(msgRef, {
                    text: messageText,
                    senderId: uid,
                    senderNickname: userData.nickname,
                    createdAt: noteTimestamp,
                    isNote: true,
                    originalNoteId: personalNoteRef.id
                });

                const todayLabel = new Date().toDateString();
                const updatePayload = {
                    messageCount: admin.firestore.FieldValue.increment(1),
                    noteCount: admin.firestore.FieldValue.increment(1),
                    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastNoteAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastNoteByNickname: userData.nickname,
                    lastNoteByUid: uid,
                    lastMessageByNickname: userData.nickname,
                    lastMessageByUid: uid,
                    [`memberLastActive.${uid}`]: admin.firestore.FieldValue.serverTimestamp(),
                    [`memberLastReadAt.${uid}`]: admin.firestore.FieldValue.serverTimestamp()
                };

                if (gData.dailyActivity?.date !== todayLabel) {
                    updatePayload.dailyActivity = { date: todayLabel, activeMembers: [uid] };
                } else {
                    updatePayload['dailyActivity.activeMembers'] = admin.firestore.FieldValue.arrayUnion(uid);
                }
                transaction.update(groupRefs[idx], updatePayload);

                const userGroupStateRef = userRef.collection('groupStates').doc(gid);
                transaction.set(userGroupStateRef, {
                    readMessageCount: admin.firestore.FieldValue.increment(1),
                    lastReadAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });

            transaction.set(personalNoteRef, {
                text: messageText,
                createdAt: noteTimestamp,
                scripture: scripture,
                chapter: chapter,
                comment: comment,
                shareOption: shareOption,
                sharedWithGroups: groupsToPostTo,
                sharedMessageIds: sharedMessageIds
            });

            // 5. Streak Announcements
            if (streakUpdated && newStreak > 0) {
                const announceMsg = (STREAK_ANNOUNCEMENT_TEMPLATES[language] || STREAK_ANNOUNCEMENT_TEMPLATES.en)
                    .replace('{nickname}', userData.nickname)
                    .replace('{streak}', newStreak);
                const announceTime = admin.firestore.Timestamp.fromMillis(noteTimestamp.toMillis() + 2000);

                const distinctGroupIds = userData.groupIds || (userData.groupId ? [userData.groupId] : []);
                distinctGroupIds.forEach(gid => {
                    const announceRef = db.collection('groups').doc(gid).collection('messages').doc();
                    transaction.set(announceRef, {
                        text: announceMsg,
                        senderId: 'system',
                        senderNickname: 'Scripture Habit Bot',
                        createdAt: announceTime,
                        isSystemMessage: true,
                        messageType: 'streakAnnouncement',
                        messageData: { nickname: userData.nickname, userId: uid, streak: newStreak }
                    });
                });
            }

            return { personalNoteId: personalNoteRef.id, newStreak, streakUpdated };
        });

        // Send push notifications after successful transaction (non-blocking)
        (async () => {
            try {
                const titleMap = {
                    'ja': '📖 新しい勉強ノート',
                    'es': '📖 Nueva nota de estudio',
                    'pt': '📖 Nova nota de estudo',
                    'ko': '📖 새로운 공부 노트',
                    'zho': '📖 新的學習筆記',
                    'vi': '📖 Ghi chú học tập mới',
                    'th': '📖 บันทึกการศึกษาใหม่',
                    'tl': '📖 Bagong Study Note',
                    'sw': '📖 Kumbukumbu Mpya ya Mafunzo'
                };
                const bodyTemplateMap = {
                    'ja': '{nickname}さんが新しいノートを投稿しました：{scripture} {chapter}',
                    'es': '{nickname} publicó una nueva nota: {scripture} {chapter}',
                    'pt': '{nickname} postou uma nova nota: {scripture} {chapter}',
                    'ko': '{nickname}님이 새로운 노트를 게시했습니다: {scripture} {chapter}',
                    'zho': '{nickname} 發布了新的筆記：{scripture} {chapter}',
                    'vi': '{nickname} đã đăng một ghi chú mới: {scripture} {chapter}',
                    'th': '{nickname} โพสต์บันทึกใหม่: {scripture} {chapter}',
                    'tl': '{nickname} ay nag-post ng bagong note: {scripture} {chapter}',
                    'sw': '{nickname} ameweka kumbukumbu mpya: {scripture} {chapter}'
                };

                const lang = language || 'en';
                const title = titleMap[lang] || '📖 New Study Note';
                const bodyTemplate = bodyTemplateMap[lang] || '{nickname} posted a new note: {scripture} {chapter}';

                const nickname = (await db.collection('users').doc(uid).get()).data()?.nickname || 'Member';
                const body = bodyTemplate
                    .replace('{nickname}', nickname)
                    .replace('{scripture}', scripture)
                    .replace('{chapter}', chapter);

                for (const gid of groupsToPostTo) {
                    await notifyGroupMembers(gid, uid, {
                        title,
                        body,
                        data: {
                            type: 'note',
                            groupId: gid
                        }
                    });
                }
            } catch (notifyErr) {
                console.error('Error sending push notifications for note:', notifyErr);
            }
        })();

        res.status(200).json({ message: 'Note posted successfully.', ...result });
    } catch (error) {
        console.error('Error posting note:', error);
        res.status(500).send(error.message || 'Error saving note.');
    }
});

app.post('/api/post-message', async (req, res) => {
    const validation = postMessageSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }

    const { groupId, text, replyTo } = validation.data;

    const authHeader = req.headers.authorization;
    let idToken;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        idToken = authHeader.split('Bearer ')[1];
    } else {
        return res.status(401).send('Unauthorized: No token provided.');
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;

        const result = await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(uid);
            const groupRef = db.collection('groups').doc(groupId);
            const userDoc = await transaction.get(userRef);
            const groupDoc = await transaction.get(groupRef);

            if (!userDoc.exists) throw new Error('User not found.');
            if (!groupDoc.exists) throw new Error('Group not found.');

            const userData = userDoc.data();
            const groupData = groupDoc.data();

            const messageRef = groupRef.collection('messages').doc();
            const messageData = {
                text,
                senderId: uid,
                senderNickname: userData.nickname || 'Member',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                isNote: false,
                isEntry: false
            };

            if (replyTo) {
                messageData.replyTo = replyTo;
            }

            transaction.set(messageRef, messageData);

            transaction.update(groupRef, {
                messageCount: admin.firestore.FieldValue.increment(1),
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
                lastMessageByNickname: userData.nickname || 'Member',
                lastMessageByUid: uid,
                [`memberLastReadAt.${uid}`]: admin.firestore.FieldValue.serverTimestamp()
            });

            // Update user's group state
            const userGroupStateRef = userRef.collection('groupStates').doc(groupId);
            transaction.set(userGroupStateRef, {
                readMessageCount: admin.firestore.FieldValue.increment(1),
                lastReadAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            return { messageId: messageRef.id, nickname: userData.nickname || 'Member' };
        });

        // Send push notifications (non-blocking)
        (async () => {
            try {
                const title = result.nickname;
                const body = text.length > 100 ? text.substring(0, 97) + '...' : text;

                await notifyGroupMembers(groupId, uid, {
                    title,
                    body,
                    data: {
                        type: 'chat',
                        groupId: groupId
                    }
                });
            } catch (notifyErr) {
                console.error('Error sending push notifications for chat:', notifyErr);
            }
        })();

        res.status(200).json({ message: 'Message sent successfully.', messageId: result.messageId });
    } catch (error) {
        console.error('Error posting message:', error);
        res.status(500).send(error.message || 'Error sending message.');
    }
});

app.get('/api/fetch-gc-metadata', async (req, res) => {
    const { url, lang } = req.query;

    if (!url) return res.status(400).send({ error: 'URL is required' });

    try {
        let targetUrl;
        try {
            targetUrl = new URL(url);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

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

        let response;
        try {
            response = await axios.get(targetUrl.toString(), {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 10000
            });
        } catch (axiosError) {
            // Fallback: If requested language fails, try without lang param
            if (lang) {
                try {
                    targetUrl.searchParams.delete('lang');
                    response = await axios.get(targetUrl.toString(), {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        },
                        timeout: 10000
                    });
                } catch (fallbackError) {
                    return res.json({ title: '', speaker: '' });
                }
            } else {
                return res.json({ title: '', speaker: '' });
            }
        }

        if (!response || !response.data) {
            return res.json({ title: '', speaker: '' });
        }

        const $ = cheerio.load(response.data);

        // Attempt to find title
        // 1. Try Open Graph Title first (usually most accurate and clean)
        let title = $('meta[property="og:title"]').attr('content');

        // 2. If no OG title, try H1 but check length to avoid capturing full body text
        if (!title) {
            const h1Text = $('h1').first().text().trim();
            // Only use H1 if it's a reasonable title length (e.g., < 200 chars)
            if (h1Text && h1Text.length < 200) {
                title = h1Text;
            }
        }

        // 3. Fallback to HTML title tag
        if (!title) {
            title = $('title').text().trim();
            // Remove common suffixes like " | The Church of Jesus Christ..."
            if (title.includes('|')) {
                title = title.split('|')[0].trim();
            }
        }

        title = title || '';

        // Attempt to find speaker
        let speaker = '';
        // Common selectors for GC talks
        if ($('div.byline p.author-name').length) {
            speaker = $('div.byline p.author-name').first().text().trim();
        } else if ($('p.author-name').length) {
            speaker = $('p.author-name').first().text().trim();
        } else if ($('a.author-name').length) {
            speaker = $('a.author-name').first().text().trim();
        } else if ($('div.byline p').length) {
            speaker = $('div.byline p').first().text().trim();
        }

        if (speaker) {
            speaker = speaker.replace(/^(By|Par|De|Por)\s+/i, '').trim();
        }

        res.json({ title, speaker });
    } catch (error) {
        console.error('Error scraping GC:', error.message);
        res.json({ title: '', speaker: '' });
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

    try {
        const langCode = language || 'en';
        const prompts = {
            'ja': `あなたはScripture Centralの創設者であり、著名な法学者、聖典学者のJohn W. Welch教授です。
ユーザーが「${scripture} ${chapter}」を読み、その学びを学習グループに共有しようとしています。
「${scripture} ${chapter}」に含まれる原則、教えをもとに、ユーザーが「${scripture} ${chapter}」に対しての知見を深められるような質問を一つだけ用意してください。
箇条書きの記号（*や-など）は使わず、質問文のみをプレーンテキストで出力してください。
ただし、聖文を読むのが苦手な求道者や新会員にもわかりやすい質問を書いてください。`,
            'es': `Eres el Profesor John W. Welch, fundador de Scripture Central y un renombrado erudito legal y bíblico.
El usuario está leyendo "${scripture} ${chapter}" y se prepara para compartir lo aprendido con su grupo de estudio.
Basándote en los principios y enseñanzas que se encuentran en "${scripture} ${chapter}", por favor proporciona una pregunta que ayude al usuario a profundizar su conocimiento sobre "${scripture} ${chapter}".
NO utilices puntos ni símbolos (*, -). Muestra ÚNICAMENTE el texto de la pregunta como texto sin formato.
Sin embargo, redacta preguntas que sean fáciles de entender incluso para investigadores o nuevos miembros que no se sientan cómodos leyendo las escrituras.`,
            'pt': `Você é o Professor John W. Welch, fundador do Scripture Central e um renomado estudioso jurídico e bíblico.
O usuário está lendo "${scripture} ${chapter}" e está se preparando para compartilhar seu aprendizado com seu grupo de estudo.
Com base nos princípios e ensinamentos encontrados em "${scripture} ${chapter}", por favor, forneça uma pergunta que ajude o usuário a aprofundar sua percepção sobre "${scripture} ${chapter}".
NÃO use marcadores ou símbolos (*, -). Forneça APENAS o texto da pergunta como texto simples.
Entretanto, escreva perguntas que sejam fáceis de entender, mesmo para pesquisadores ou novos membros que não se sintam confortáveis em ler as escrituras.`,
            'vi': `Bạn là Giáo sư John W. Welch, người sáng lập Scripture Central, một học giả pháp lý và Kinh Thánh nổi tiếng.
Người dùng đang đọc "${scripture} ${chapter}" và đang chuẩn bị chia sẻ những gì họ học được với nhóm học tập của mình.
Dựa trên các nguyên tắc và lời dạy trong "${scripture} ${chapter}", vui lòng cung cấp một câu hỏi giúp người dùng tìm hiểu sâu hơn về "${scripture} ${chapter}".
KHÔNG sử dụng dấu đầu dòng hoặc ký hiệu (*, -). CHỈ xuất văn bản câu hỏi dưới dạng văn bản thuần túy.
Tuy nhiên, hãy viết những câu hỏi dễ hiểu ngay cả đối với những người tìm hiểu hoặc những thành viên mới không giỏi đọc thánh thư.`,
            'th': `คุณคือศาสตราจารย์ John W. Welch ผู้ก่อตั้ง Scripture Central และเป็นนักวิชาการด้านกฎหมายและพระคัมภีร์ที่มีชื่อเสียง
ผู้ใช้กำลังอ่าน "${scripture} ${chapter}" และกำลังเตรียมที่จะแบ่งปันสิ่งที่ได้เรียนรู้กับกลุ่มการศึกษาของตน
ตามหลักธรรมและคำสอนที่พบใน "${scripture} ${chapter}" โปรดเตรียมคำถามหนึ่งข้อที่ช่วยให้ผู้ใช้เพิ่มพ่นความเข้าใจที่ลึกซึ้งใน "${scripture} ${chapter}"
ห้ามใช้เครื่องหมายหัวข้อหรือสัญลักษณ์ (*, -) ให้แสดงเฉพาะข้อความคำถามเป็นรูปแบบข้อความธรรมดาเท่านั้น
อย่างไรก็ตาม โปรดเขียนคำถามที่เข้าใจง่ายแม้แต่สำหรับผู้สนใจหรือสมาชิกใหม่ที่ไม่ถนัดในการอ่านพระคัมภีร์`,
            'ko': `당신은 Scripture Central의 창립자이자 저명한 법학자 및 성서 학자인 존 W. 웰치(John W. Welch) 교수입니다.
사용자가 "${scripture} Korea: ${chapter}"를 읽고 있으며, 그 배운 내용을 학습 그룹과 공유하려고 합니다.
"${scripture} ${chapter}"에 담긴 원리와 가르침을 바탕으로, 사용자가 "${scripture} ${chapter}"에 대한 견해를 넓힐 수 있는 질문을 하나만 준비해 주세요.
글머리 기호나 기호(*, - 등)는 사용하지 말고 질문 문구만 평문으로 출력해 주세요.
다만, 경전을 읽는 것이 익숙하지 않은 구도자나 신회원들도 이해하기 쉬운 질문을 작성해 주세요.`,
            'zho': `您是 Scripture Central 的創始人，著名的法學家及聖經學者約翰·威爾奇（John W. Welch）教授。
使用者正在閱讀「${scripture} ${chapter}」，並準備與他們的學習小組分享所學內容。
根據「${scripture} ${chapter}」中的原則和教導，請提供一個問題，幫助使用者深化對「${scripture} ${chapter}」的見解。
不要使用項目符號或符號（*、-等）。僅以純文字形式輸出問題文本。
但是，請撰寫對於不擅長閱讀聖經的求道者或新成員也易於理解的問題。`,
            'tl': `Ikaw ay si Professor John W. Welch, ang tagapagtatag ng Scripture Central at isang tanyag na legal at biblical scholar.
Ang user ay nagbabasa ng "${scripture} ${chapter}" at naghahanda na ibahagi ang kanilang natutunan sa kanilang study group.
Batay sa mga prinsipyo at turo na matatagpuan sa "${scripture} ${chapter}", mangyaring magbigay ng isang tanong na makakatulong sa user na palalimin ang kanilang insight sa "${scripture} ${chapter}".
HUWAG gumamit ng mga bullet point o simbolo (*, -). I-output LAMANG ang teksto ng tanong bilang plain text.
Gayunpaman, mangyaring sumulat ng mga tanong na madaling maunawaan kahit para sa mga investigator o bagong miyembro na hindi sanay magbasa ng mga banal na kasulatan.`,
            'sw': `Wewe ni Profesa John W. Welch, mwanzilishi wa Scripture Central na msomi mashuhuri wa sheria na Biblia.
Mtumiaji anasoma "${scripture} ${chapter}" na anajiandaa kushiriki kile alichojifunza na kikundi chake cha masomo.
Kulingana na kanuni na mafundisho yanayopatikana katika "${scripture} ${chapter}", tafadhali toa swali moja ambalo linamsaidia mtumiaji kukuza uelewa wake kuhusu "${scripture} ${chapter}".
USITUMIE alama za vitone au alama (*, -). Toa maandishi ya swali PEKEE kama maandishi ya kawaida.
Hata hivyo, tafadhali andika maswali ambayo ni rahisi kueleweka hata kwa watafiti au waumini wapya ambao hawajazoea kusoma maandiko.`
        };

        let prompt = prompts[langCode] || `You are Professor John W. Welch, founder of Scripture Central and a renowned legal and biblical scholar.
The user is reading "${scripture} ${chapter}" and is preparing to share their learning with their study group.
Based on the principles and teachings found in "${scripture} ${chapter}", please provide one question that helps the user deepen their insight into "${scripture} ${chapter}".
Do NOT use bullet points or symbols (*, -). Output only the question text as plain text.
However, please write questions that are easy to understand even for investigators or new members who are not comfortable reading scriptures.`;

        const apiKey = (process.env.GEMINI_API_KEY || '').trim();
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-12b-it:generateContent?key=${apiKey}`;

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
        let detail = error.message;
        if (error.response && error.response.data) {
            console.error('Gemini API Error:', error.response.data);
            detail = JSON.stringify(error.response.data);
        }
        res.status(500).json({ error: 'Failed to generate questions.', details: detail });
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
            .limit(200)
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
        const notesText = notes.join("\n\n---\n\n");

        const prompts = {
            'ja': `あなたはScripture Centralの創設者であり、著名な法学者、聖典学者のJohn W Welch教授であり、末日聖徒イエス・キリスト教会の聖典学習グループのアナウンサーです。
以下は、グループメンバーが過去1週間に共有した（匿名の）学習ノートの内容です。
これらを分析し、グループ全体の「学習トレンド」や「深まっているテーマ」について、短く励ましとなるようなレポートを作成してください。
出力形式:
「今週の振り返り：」で始め、その後に分析結果を続けてください。
例：「今週の振り返り：今週はグループ全体で『祈り』についての学びが深まっているようです！多くのメンバーがアルマ書から主の憐れみについて感じています。」
特定の個人の名前や詳細なプライバシーには触れず、ポジティブな全体の傾向を伝えてください。
です・ます常体で、親しみやすく記述してください。

ノート内容:
${notesText}`,
            'es': `Eres el profesor John W. Welch, fundador de Scripture Central y un renombrado erudito legal y bíblico, actuando como locutor de un grupo de estudio de las Escrituras de La Iglesia de Jesucristo de los Santos de los Últimos Días.
A continuación se presentan las notas de estudio (anónimas) compartidas por los miembros del grupo durante la última semana.
Analícelas y cree un informe breve y alentador sobre las "tendencias de aprendizaje" o los "temas que se están profundizando" en el grupo.
Formato de salida:
Comience con "Reflexión semanal:", seguido de su análisis.
Ejemplo: "Reflexión semanal: ¡Esta semana el grupo parece estar profundizando en su comprensión de la 'Oración'! Muchos miembros están sintiendo la misericordia del Señor a través del Libro de Alma."
No mencione nombres individuales ni detalles privados. Enfóquese en tendencias positivas generales.
Mantenga un tono amigable y edificante.

Contenido de las notas:
${notesText}`,
            'pt': `Você é o Professor John W. Welch, fundador do Scripture Central e um renomado estudioso jurídico e bíblico, atuando como locutor de um grupo de estudo das escrituras de A Igreja de Jesus Cristo dos Santos dos Últimos Dias.
Abaixo estão as notas de estudo (anônimas) compartilhadas pelos membros do grupo na última semana.
Analise-as e crie um relatório curto e encorajador sobre as "tendências de aprendizado" ou "temas que estão se aprofundando" no grupo.
Formato de saída:
Comece com "Reflexão Semanal:", seguido de sua análise.
Exemplo: "Reflexão Semanal: Esta semana, o grupo parece estar aprofundando sua compreensão sobre a 'Oração'! Muitos membros estão sentindo a misericórdia do Senhor através do Livro de Alma."
Não mencione nomes individuais ou detalhes privados. Foque em tendências positivas gerais.
Mantenha um tom amigável e inspirador.

Conteúdo das notas:
${notesText}`,
            'vi': `Bạn là Giáo sư John W. Welch, người sáng lập Scripture Central, một học giả pháp lý và Kinh Thánh nổi tiếng, đồng thời là người thông báo cho nhóm học tập thánh thư của Giáo hội Các Thánh hữu Ngày sau của Chúa Giê-su Ky Tô.
Dưới đây là các ghi chú học tập (ẩn danh) được các thành viên trong nhóm chia sẻ trong tuần qua.
Hãy phân tích chúng và tạo một báo cáo ngắn gọn, khích lệ về "xu hướng học tập" hoặc "các chủ đề đang được tìm hiểu sâu" của nhóm.
Định dạng đầu ra:
Bắt đầu bằng "Suy ngẫm hàng tuần:", sau đó là phần phân tích của bạn.
Ví dụ: "Suy ngẫm hàng tuần: Tuần này, nhóm dường như đang đào sâu sự hiểu biết về 'Sự cầu nguyện'! Nhiều thành viên đang cảm nhận được lòng thương xót của Chúa qua Sách An Ma."
Không đề cập đến tên cá nhân cụ thể hoặc chi tiết riêng tư. Tập trung vào các xu hướng tích cực tổng thể.
Hãy giữ giọng điệu thân thiện và nâng cao tinh thần.

Nội dung ghi chú:
${notesText}`,
            'th': `คุณคือศาสตราจารย์ John W. Welch ผู้ก่อตั้ง Scripture Central และเป็นนักวิชาการด้านกฎหมายและพระคัมภีร์ที่มีชื่อเสียง โดยทำหน้าที่เป็นผู้ประกาศสำหรับกลุ่มการศึกษาพระคัมภีร์ของศาสนจักรของพระเยซูคริสต์แห่งวิสุทธิชนยุคสุดท้าย
ด้านล่างนี้คือบันทึกการศึกษา (แบบไม่ระบุตัวตน) ที่สมาชิกในกลุ่มแบ่งปันในช่วงสัปดาห์ที่ผ่านมา
โปรดวิเคราะห์บันทึกเหล่านี้และสร้างรายงานสั้นๆ ที่ให้กำลังใจเกี่ยวกับ "แนวโน้มการเรียนรู้" หรือ "หัวข้อที่กำลังได้รับความสนใจ" ของกลุ่ม
รูปแบบการแสดงผล:
เริ่มต้นด้วย "การไตร่ตรองประจำสัปดาห์:" ตามด้วยการวิเคราะห์ของคุณ
ตัวอย่าง: "การไตร่ตรองประจำสัปดาห์: สัปดาห์นี้ ดูเหมือนว่ากลุ่มกำลังทำความเข้าใจลึกซึ้งขึ้นเกี่ยวกับ 'การสวดอ้อนวอน'! สมาชิกหลายคนสัมผัสได้ถึงความเมตตาของพระเจ้าจากหนังสือแอลมา"
ห้ามระบุชื่อบุคคลหรือรายละเอียดส่วนตัว ให้เน้นที่แนวโน้มในเชิงบวกโดยรวม
โปรดรักษาโทนที่เปี่ยมด้วยมิตรภาพและช่วยยกระดับจิตวิญญาณ

เนื้อหาของบันทึก:
${notesText}`,
            'ko': `당신은 Scripture Central의 창립자이자 저명한 법학자 및 성서 학자인 존 W. 웰치(John W. Welch) 교수이며, 예수 그리스도 후기 성도 교회의 성전 학습 그룹 아나운서입니다.
다음은 지난 한 주 동안 그룹 멤버들이 공유한 (익명) 학습 노트 내용입니다.
이것들을 분석하여 그룹 전체의 '학습 트렌드'나 '깊어지고 있는 테마'에 대해 짧고 격려가 되는 보고서를 작성해 주세요.
출력 형식:
"이번 주의 되돌아보기:"로 시작하고 그 뒤에 분석 결과를 이어서 작성하세요.
예: "이번 주의 되돌아보기: 이번 주는 그룹 전체적으로 '기도'에 대한 배움이 깊어지고 있는 것 같습니다! 많은 분들이 앨마서에서 주의 자비하심을 느끼고 계시네요."
특정 개인의 이름이나 구체적인 사생활은 언급하지 말고, 긍정적인 전체적 경향을 전달해 주세요.
친근하고 영감을 주는 톤으로 작성해 주세요.

노트 내용:
${notesText}`,
            'zho': `您是 Scripture Central 的創始人，著名的法學家及聖經學者約翰·威爾奇（John W. Welch）教授，同時也是耶穌基督後期聖徒教會聖典學習小組的宣佈員。
以下是小組成員在過去一週分享的（匿名）學習筆記內容。
請分析這些內容，並就小組整體的「學習趨勢」或「正在深化的主題」撰寫一份簡短且具鼓勵性的報告。
輸出格式：
以「本週回顧：」開頭，隨後接上您的分析。
範例：「本週回顧：本週小組整體似乎對『祈禱』有了更深的理解！許多成員從阿爾瑪書中感受到了主的憐憫。」
不要提到特定個人的姓名或隱私細節。專注於整體的積極趨勢。
請保持親切且令人振奮的語氣。

筆記內容：
${notesText}`,
            'tl': `Ikaw ay si Professor John W. Welch, ang tagapagtatag ng Scripture Central at isang tanyag na legal at biblical scholar, na nagsisilbing announcer para sa isang scripture study group ng Ang Simbahan ni Jesucristo ng mga Banal sa mga Huling Araw.
Nasa ibaba ang mga (anonymized) study notes na ibinahagi ng mga miyembro ng grupo sa nakaraang linggo.
Suriin ang mga ito at gumawa ng maikli at nakaka-enkanyong ulat tungkol sa "learning trends" o "deepening themes" ng grupo.
Format ng Output:
Magsimula sa "Weekly Reflection:", na susundan ng iyong pagsusuri.
Halimbawa: "Weekly Reflection: Ngayong linggo, tila pinalalalim ng grupo ang kanilang pag-unawa sa 'Panalangin'! Maraming miyembro ang nakakaramdam ng awa ng Panginoon mula sa Aklat ni Alma."
Huwag banggitin ang mga partikular na pangalan ng indibidwal o pribadong detalye. Tumutok sa mga positibong pangkalahatang trend.
Panatilihing palakaibigan at nakakapagpasigla ang tono.

Nilalaman ng mga Notes:
${notesText}`,
            'sw': `Wewe ni Profesa John W. Welch, mwanzilishi wa Scripture Central na msomi mashuhuri wa sheria na Biblia, anayefanya kazi kama mtangazaji wa kikundi cha mafunzo ya maandiko cha Kanisa la Yesu Kristo la Watakatifu wa Siku za Mwisho.
Hapa chini kuna maelezo (yasiyotajwa majina) ya mafunzo yaliyoshirikiwa na washiriki wa kikundi katika wiki iliyopita.
Yachambue na utengeneze ripoti fupi na ya kutia moyo kuhusu "mielekeo ya mafunzo" au "mada zinazozidi kuongezeka" za kikundi.
Mfumo wa Pato:
Anza na "Tafakari ya Wiki:", ikifuatiwa na uchambuzi wako.
Mfano: "Tafakari ya Wiki: Wiki hii, kikundi kinaonekana kuongeza uelewa wao kuhusu 'Sala'! Washiriki wengi wanahisi rehema za Bwana kupitia Kitabu cha Alma."
Usitaje majina ya watu binafsi au maelezo ya siri. Zingatia mielekeo mizuri ya jumla.
Dumisha sauti ya kirafiki na ya kutia moyo.

Maudhui ya Maelezo:
${notesText}`
        };

        let prompt = prompts[langCode] || `You are Professor John W. Welch, founder of Scripture Central and a renowned legal and biblical scholar, serving as an announcer for a scripture study group of The Church of Jesus Christ of Latter-day Saints.
Below are the (anonymized) study notes shared by group members over the past week.
Analyze them and create a short, encouraging report on the group's "learning trends" or "deepening themes".
Output Format:
Start with "Weekly Reflection:", followed by your analysis.
Example: "Weekly Reflection: This week, the group seems to be deepening their understanding of 'Prayer'! Many members are feeling the Lord's mercy from the Book of Alma."
Do not mention specific individual names or private details. Focus on positive overall trends.
Keep it friendly and uplifting.

Notes Content:
${notesText}`;

        const apiKey = (process.env.GEMINI_API_KEY || '').trim();
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-12b-it:generateContent?key=${apiKey}`;

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
        let detail = error.message;
        if (error.response && error.response.data) {
            detail = JSON.stringify(error.response.data);
        }
        res.status(500).json({ error: 'Failed to generate recap.', details: detail });
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
        const notesText = notes.join("\n\n---\n\n");

        const prompts = {
            'ja': `あなたはScripture Centralの創設者であり、著名な法学者、聖典学者のJohn W Welch教授であり、ユーザーの聖典学習をサポートする親しい友人、あるいはメンターです。
以下は、ユーザーが過去1週間に記録した学習ノートです。
これらをもとに、ユーザーへの「今週の振り返りレター」を書いてください。
条件:
1. ユーザーの頑張りを褒め、励ますような温かいトーンで。
2. ノートから読み取れる霊的な洞察やテーマ（例：信仰、祈り、愛など）を取り上げてください。
3. 「親愛なる友へ」のような書き出しで始めてください。
4. 箇条書きではなく、手紙形式の文章にしてください。
5. 日本語で記述してください。
6. 文末はScripture Habitよりで終わらせるようにしてください。

ユーザーのノート:
${notesText}`,
            'es': `Eres el Profesor John W. Welch, fundador de Scripture Central y un renombrado erudito legal y bíblico, y actúas como un amigo cercano o mentor que apoya el estudio de las Escrituras del usuario.
A continuación se presentan las notas de estudio que el usuario registró durante la última semana.
Basándose en ellas, escriba una "Carta de Reflexión Semanal" al usuario.
Requisitos:
1. Utilice un tono cálido y alentador que elogie sus esfuerzos.
2. Destaque ideas o temas espirituales (por ejemplo: fe, oración, amor) encontrados en sus notas.
3. Comience con un saludo como "Querido amigo:".
4. Escriba en formato de carta, no en viñetas.
5. Escriba en español.
6. Termine la carta con "Scripture Habit".

Notas del usuario:
${notesText}`,
            'pt': `Você é o Professor John W. Welch, fundador do Scripture Central e um renomado estudioso jurídico e bíblico, e atua como um amigo próximo ou mentor que apoia o estudo das escrituras do usuário.
Abaixo estão as notas de estudo que o usuário registrou na última semana.
Com base nelas, escreva uma "Carta de Reflexão Semanal" para o usuário.
Requisitos:
1. Use um tom caloroso e encorajador que elogie seus esforços.
2. Destaque percepções ou temas espirituais (ex: fé, oração, amor) encontrados em suas notas.
3. Comece com uma saudação como "Querido amigo,".
4. Escreva em formato de carta, não em tópicos.
5. Escreva em português.
6. Termine a carta com "Scripture Habit".

Notas do usuário:
${notesText}`,
            'vi': `Bạn là Giáo sư John W. Welch, người sáng lập Scripture Central, một học giả pháp lý và Kinh Thánh nổi tiếng, đồng thời là một người bạn thân thiết hoặc người cố vấn hỗ trợ việc học thánh thư của người dùng.
Dưới đây là các ghi chú học tập mà người dùng đã ghi lại trong tuần qua.
Dựa trên những ghi chú này, vui lòng viết một "Thư suy ngẫm hàng tuần" cho người dùng.
Yêu cầu:
1. Sử dụng giọng điệu ấm áp, khích lệ, khen ngợi những nỗ lực của họ.
2. Làm nổi bật các hiểu biết hoặc chủ đề thuộc linh (ví dụ: đức tin, sự cầu nguyện, tình yêu thương) được tìm thấy trong ghi chú của họ.
3. Bắt đầu bằng lời chào như "Bạn thân mến,".
4. Viết dưới dạng một bức thư, không phải liệt kê theo đầu dòng.
5. Viết bằng tiếng Việt.
6. Kết thúc lá thư bằng "Scripture Habit".

Ghi chú của người dùng:
${notesText}`,
            'th': `คุณคือศาสตราจารย์ John W. Welch ผู้ก่อตั้ง Scripture Central และเป็นนักวิชาการด้านกฎหมายและพระคัมภีร์ที่มีชื่อเสียง โดยทำหน้าที่เป็นเพื่อนสนิทหรือที่ปรึกษาที่สนับสนุนการศึกษาพระคัมภีร์ของผู้ใช้
ด้านล่างนี้คือบันทึกการศึกษาที่ผู้ใช้บันทึกไว้ในช่วงสัปดาห์ที่ผ่านมา
จากบันทึกเหล่านี้ โปรดเขียน "จดหมายไตร่ตรองประจำสัปดาห์" ถึงผู้ใช้
ข้อกำหนด:
1. ใช้โทนเสียงที่อบอุ่นและให้กำลังใจซึ่งยกย่องความพยายามของพวกเขา
2. เน้นข้อคิดทางวิญญาณหรือหัวข้อ (เช่น ศรัทธา การสวดอ้อนวอน ความรัก) ที่พบในบันทึกของพวกเขา
3. เริ่มต้นด้วยคำทักทายเช่น "ถึงเพื่อนรัก,"
4. เขียนในรูปแบบจดหมาย ไม่ใช่แบบรายการหัวข้อข้อความ
5. เขียนเป็นภาษาไทย
6. จบจดหมายด้วย "Scripture Habit"

บันทึกของผู้ใช้:
${notesText}`,
            'ko': `당신은 Scripture Central의 창립자이자 저명한 법학자 및 성서 학자인 존 W. 웰치(John W. Welch) 교수이며, 사용자의 성경 공부를 지원하는 친한 친구 또는 멘토입니다.
다음은 사용자가 지난 한 주 동안 기록한 학습 노트입니다.
이를 바탕으로 사용자에게 '이번 주의 되돌아보기 편지'를 써 주세요.
조건:
1. 사용자의 노력을 칭찬하고 격려하는 따뜻한 톤으로 작성해 주세요.
2. 노트에서 읽어낼 수 있는 영적인 통찰이나 테마(예: 신앙, 기도, 사랑 등)를 다루어 주세요.
3. "친애하는 친구에게"와 같은 인사말로 시작해 주세요.
4. 글머리 기호가 아닌 편지 형식의 문장으로 작성해 주세요.
5. 한국어로 작성해 주세요.
6. 편지 끝에 "Scripture Habit"라고 적어주세요.

사용자의 노트:
${notesText}`,
            'zho': `您是 Scripture Central 的創始人，著名的法學家及聖經學者約翰·威爾奇（John W. Welch）教授，同時也是支持使用者進行聖典學習的親密朋友或導師。
以下是使用者在過去一週記錄的學習筆記。
根據這些筆記，請給使用者寫一封「本週回顧信」。
條件：
1. 以溫暖且具鼓勵性的語氣表揚並激勵使用者的努力。
2. 提煉筆記中體現的靈通見解或主題（例如：信心、祈禱、愛等）。
3. 請以「親愛的朋友：」之類的開頭。
4. 使用書信格式，而非項目符號。
5. 請用繁體中文撰写。
6. 在信末註明「Scripture Habit」。

使用者的筆記：
${notesText}`,
            'tl': `Ikaw ay si Professor John W. Welch, ang tagapagtatag ng Scripture Central at isang tanyag na legal at biblical scholar, at nagsisilbi bilang isang malapit na kaibigan o mentor na sumusuporta sa pag-aaral ng banal na kasulatan ng user.
Nasa ibaba ang mga study notes na itinala ng user sa nakaraang linggo.
Batay sa mga ito, mangyaring sumulat ng isang "Weekly Reflection Letter" sa user.
Mga Kinakailangan:
1. Gumamit ng mainit at nakaka-enkanyong tono na pumupuri sa kanilang mga pagsisikap.
2. I-highlight ang mga espirituwal na insight o tema (hal., pananampalataya, panalangin, pagmamahal) na matatagpuan sa kanilang mga tala.
3. Magsimula sa isang pagbati tulaka ng "Mahal kong Kaibigan,".
4. Sumulat sa format ng isang liham, hindi sa mga bullet point.
5. Sumulat sa wikang Tagalog.
6. Tapusin ang liham gamit ang "Scripture Habit".

Mga Tala ng User:
${notesText}`,
            'sw': `Wewe ni Profesa John W. Welch, mwanzilishi wa Scripture Central na msomi mashuhuri wa sheria na Biblia, na unafanya kazi kama rafiki wa karibu au mshauri anayeunga mkono mafunzo ya maandiko ya mtumiaji.
Hapa chini kuna maelezo ya mafunzo ambayo mtumiaji amerekodi katika wiki iliyopita.
Kulingana na hayo, tafadhali mwandikie mtumiaji "Barua ya Tafakari ya Wiki".
Mahitaji:
1. Tumia sauti ya joto na ya kutia moyo inayokusifu jitihada zao.
2. Angazia ufahamu wa kiroho au mada (mfano: imani, sala, upendo) zinazopatikana katika maelezo yake.
3. Anza na salamu kama "Mpendwa Rafiki,".
4. Andika katika mfumo wa barua, si orodha ya vitone.
5. Andika kwa Kiswahili.
6. Malizia barua kwa "Scripture Habit".

Maelezo ya Mtumiaji:
${notesText}`
        };

        let prompt = prompts[langCode] || `You are Professor John W. Welch, founder of Scripture Central and a renowned legal and biblical scholar, serving as a close friend or mentor supporting the user's scripture study.
Below are the study notes the user recorded over the past week.
Based on these, please write a "Weekly Reflection Letter" to the user.
Requirements:
1. Use a warm, encouraging tone that praises their efforts.
2. Highlight spiritual insights or themes (e.g., faith, prayer, love) found in their notes.
3. Start with a greeting like "Dear Friend,".
4. Write in a letter format, not bullet points.
5. End the letter with "Scripture Habit".

User's Notes:
${notesText}`;

        const apiKey = (process.env.GEMINI_API_KEY || '').trim();
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-12b-it:generateContent?key=${apiKey}`;

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
        let detail = error.message;
        if (error.response && error.response.data) {
            detail = JSON.stringify(error.response.data);
        }
        res.status(500).json({ error: 'Failed to generate recap.', details: detail });
    }
});

/*
// OLD VERSION - COMMENTED OUT - Duplicate endpoint
// Check Inactive Users (Cron Job)
app.get('/api/check-inactive-users', async (req, res) => {
    // Optional: Protect with secret
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        // Allow manual run for now if secret matching, or maybe open it temporarily
        // But let's keep it safe if secret exists.
    }


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

            // If this is a user message (specifically a NOTE/ENTRY) and we haven't found a newer one for this user match
            if (senderId && (data.isNote || data.isEntry) && members.includes(senderId) && !foundMembers.has(senderId)) {
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
*/

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

            console.log(`\nProcessing group ${groupId} (${groupData.name || 'Unnamed'}) with ${members.length} members`);

            if (members.length === 0) continue;

            let groupChanged = false;
            let groupUpdates = {};
            let isGroupDeleted = false;

            // Classify members
            const activeMembers = [];
            const inactiveMembers = [];
            const membersToInitialize = [];

            for (const memberId of members) {
                // Skip owner for now (checked separately)
                if (memberId === ownerUserId) {
                    console.log(`  Member ${memberId} is owner, checking separately`);
                }

                const lastActiveTimestamp = memberLastActive[memberId];

                if (!lastActiveTimestamp) {
                    // Initialize tracking if missing (giving them a fresh start)
                    console.log(`  Member ${memberId} has no lastActive timestamp, initializing`);
                    membersToInitialize.push(memberId);
                    activeMembers.push(memberId); // Treat as active for ownership transfer purposes
                } else {
                    const lastActiveDate = lastActiveTimestamp.toDate();
                    const diff = now - lastActiveDate;
                    const daysDiff = Math.floor(diff / (24 * 60 * 60 * 1000));

                    console.log(`  Member ${memberId}: last active ${daysDiff} days ago (${lastActiveDate.toISOString()})`);

                    if (diff > THREE_DAYS_MS) {
                        console.log(`    ⚠️ Member ${memberId} is inactive (${daysDiff} days), marking for removal`);
                        inactiveMembers.push(memberId);
                    } else {
                        console.log(`    ✅ Member ${memberId} is active (${daysDiff} days)`);
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
                    // We must use recursiveDelete to remove subcollections like 'messages'
                    await db.recursiveDelete(groupsRef.doc(groupId));
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

// Manual Test Endpoint for Debugging Inactivity (specific group)
app.get('/api/test-inactive-check/:groupId', async (req, res) => {
    const { groupId } = req.params;

    console.log(`\n🔍 Manual inactivity check for group: ${groupId}`);
    const db = admin.firestore();

    try {
        const groupRef = db.collection('groups').doc(groupId);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const groupData = groupDoc.data();
        const members = groupData.members || [];
        const memberLastActive = groupData.memberLastActive || {};
        const ownerUserId = groupData.ownerUserId;

        const now = new Date();
        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

        const report = {
            groupId,
            groupName: groupData.name,
            totalMembers: members.length,
            ownerUserId,
            checkTime: now.toISOString(),
            members: []
        };

        for (const memberId of members) {
            const memberInfo = {
                memberId,
                isOwner: memberId === ownerUserId
            };

            if (memberId === ownerUserId) {
                memberInfo.status = 'Owner (skipped)';
                memberInfo.action = 'none';
            } else {
                const lastActiveTimestamp = memberLastActive[memberId];

                if (!lastActiveTimestamp) {
                    memberInfo.status = 'No tracking data';
                    memberInfo.action = 'would initialize';
                    memberInfo.lastActive = null;
                    memberInfo.daysSinceActive = null;
                } else {
                    const lastActiveDate = lastActiveTimestamp.toDate();
                    const diff = now - lastActiveDate;
                    const daysDiff = Math.floor(diff / (24 * 60 * 60 * 1000));

                    memberInfo.lastActive = lastActiveDate.toISOString();
                    memberInfo.daysSinceActive = daysDiff;
                    memberInfo.status = daysDiff > 3 ? '⚠️ Inactive' : '✅ Active';
                    memberInfo.action = daysDiff > 3 ? 'would remove' : 'keep';
                }
            }

            report.members.push(memberInfo);
        }

        res.json(report);

    } catch (error) {
        console.error('Error in test inactive check:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/translate', aiLimiter, async (req, res) => {
    const validation = translateSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }
    const { text, targetLanguage } = validation.data;

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API Key is not configured.' });
    }

    try {
        const db = admin.firestore();
        // Generate a cache key
        const cacheKey = crypto.createHash('md5').update(`${text}_${targetLanguage}`).digest('hex');
        const cacheRef = db.collection('translation_cache').doc(cacheKey);

        // 1. Check Cache
        const cacheDoc = await cacheRef.get();
        if (cacheDoc.exists) {
            const cachedData = cacheDoc.data();
            console.log('Serving translation from cache');
            return res.json({ translatedText: cachedData.translatedText });
        }

        const prompt = `You are a professional translator for "Scripture Habit", a scripture study app. 
Translate the following scripture study note or chat message into the target language: ${targetLanguage}.
If the text is already in ${targetLanguage}, return it as is.
Keep the original meaning and tone. If there are scripture references, try to use the official translation if possible.
Output ONLY the translated text, no acknowledgments or explanations.

Text:
${text}`;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-12b-it:generateContent?key=${process.env.GEMINI_API_KEY}`;

        const response = await axios.post(apiUrl, {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        });

        const translatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!translatedText) {
            throw new Error('No content generated from Gemini.');
        }

        const resultText = translatedText.trim();

        // 2. Save to Cache (asynchronously, don't block response)
        cacheRef.set({
            originalText: text,
            translatedText: resultText,
            targetLanguage: targetLanguage,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        }).catch(err => console.error('Error saving to translation cache:', err));

        res.json({ translatedText: resultText });
    } catch (error) {
        console.error('Error in AI translation:', error.message);
        res.status(500).json({ error: 'Failed to translate' });
    }
});

// Export the app for Vercel
export default app;
