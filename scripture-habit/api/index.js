import express from 'express';
import admin from 'firebase-admin';
import cors from 'cors';
import dotenv from 'dotenv';

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

// Export the app for Vercel
export default app;
