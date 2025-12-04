// Vercel Serverless Function for deleting groups
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
let db;
try {
    if (!admin.apps.length) {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('FIREBASE_PRIVATE_KEY is not set');
        }
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey.replace(/\\n/g, '\n'),
            }),
        });
    }
    db = admin.firestore();
} catch (initError) {
    console.error('Firebase initialization error:', initError);
}

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Check if Firebase was initialized
    if (!db) {
        return res.status(500).json({ error: 'Firebase not initialized. Check environment variables.' });
    }

    try {
        const { groupId, userId } = req.body;

        if (!groupId || !userId) {
            return res.status(400).json({ error: 'Missing groupId or userId' });
        }

        // Get group data
        const groupRef = db.collection('groups').doc(groupId);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const groupData = groupDoc.data();

        // Verify ownership
        if (groupData.ownerId !== userId) {
            return res.status(403).json({ error: 'Only the group owner can delete this group' });
        }

        const members = groupData.members || [];

        // 1. Update all members' groupIds and groupStates
        for (const memberId of members) {
            const userRef = db.collection('users').doc(memberId);
            const userDoc = await userRef.get();

            if (userDoc.exists) {
                const userData = userDoc.data();
                const updatedGroupIds = (userData.groupIds || []).filter(id => id !== groupId);

                const updates = { groupIds: updatedGroupIds };

                if (userData.groupId === groupId) {
                    updates.groupId = updatedGroupIds.length > 0 ? updatedGroupIds[0] : null;
                }

                await userRef.update(updates);

                // Delete groupState
                try {
                    await db.collection('users').doc(memberId).collection('groupStates').doc(groupId).delete();
                } catch (err) {
                    console.log(`Could not delete groupState for user ${memberId}:`, err.message);
                }
            }
        }

        // 2. Delete all messages in the group
        const messagesRef = groupRef.collection('messages');
        const messagesSnapshot = await messagesRef.get();

        const batch = db.batch();
        messagesSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        // 3. Delete the group document
        await groupRef.delete();

        return res.status(200).json({ success: true, message: 'Group deleted successfully' });

    } catch (error) {
        console.error('Error deleting group:', error);
        return res.status(500).json({ error: 'Failed to delete group', details: error.message });
    }
};
