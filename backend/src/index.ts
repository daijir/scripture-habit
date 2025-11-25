import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';

// Initialize firebase-admin using default credentials when running in Cloud Functions
// For local dev with service account, set GOOGLE_APPLICATION_CREDENTIALS env var.
try {
  admin.initializeApp();
} catch (err) {
  // best-effort: if already initialized, ignore
}

const db = admin.firestore();
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

// Return public groups (match frontend field `isPublic`)
app.get('/groups', async (_req, res) => {
  try {
    // Support optional client-side filters to mirror frontend behavior
    const membersCountLt = _req.query?.membersCountLt ? Number(_req.query.membersCountLt) : undefined;
    // Firestore doesn't support OR queries; to be backward-compatible with older docs
    // that used `public: true` we will query both `isPublic` and `public` and merge results.
    const groupsMap: Record<string, any> = {};

    const buildQuery = (field: string) => {
      let qq: FirebaseFirestore.Query = db.collection('groups').where(field, '==', true);
      if (typeof membersCountLt === 'number' && !Number.isNaN(membersCountLt)) {
        qq = qq.where('membersCount', '<', membersCountLt);
      }
      return qq;
    };

    const q1 = buildQuery('isPublic');
    const snap1 = await q1.get();
    snap1.docs.forEach((d) => { groupsMap[d.id] = { id: d.id, ...(d.data() as any) }; });

    // Also query legacy `public` field and merge
    const q2 = buildQuery('public');
    const snap2 = await q2.get();
    snap2.docs.forEach((d) => { groupsMap[d.id] = { id: d.id, ...(d.data() as any) }; });

    const groups = Object.values(groupsMap);
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: 'failed to fetch groups', details: String(err) });
  }
});

// Join a group (simple validation). Expects { groupId, userId }
// Middleware to verify Firebase ID token from `Authorization: Bearer <token>` header
async function verifyIdToken(req: any, res: any, next: any) {
  const authHeader = (req.headers.authorization || req.headers.Authorization) as string | undefined;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const idToken = authHeader.split(' ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    // attach uid to request for handlers
    req.userUid = decoded.uid;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid ID token', details: String(err) });
  }
}

app.post('/join-group', verifyIdToken, async (req: any, res: any) => {
  const { groupId } = req.body;
  const userId = req.userUid as string | undefined;
  if (!groupId) return res.status(400).json({ error: 'groupId required' });
  if (!userId) return res.status(401).json({ error: 'authentication required' });

  try {
    const groupRef = db.collection('groups').doc(groupId);
    const g = await groupRef.get();
    if (!g.exists) return res.status(404).json({ error: 'group not found' });
    const data = g.data() as any;

    // If group is public, allow join. Private groups require invite (not implemented yet).
    // Allow either `isPublic` (new) or `public` (legacy) to permit joining public groups
    if (data?.isPublic || data?.public) {
      // Prevent double-joins
      const isAlreadyMember = Array.isArray(data.members) && data.members.includes(userId);
      if (isAlreadyMember) {
        return res.status(200).json({ ok: true, message: 'already a member' });
      }

      // Use a transaction to update group and user atomically
      await db.runTransaction(async (t) => {
        const grpSnap = await t.get(groupRef);
        if (!grpSnap.exists) throw new Error('group disappeared');
        const grpData = grpSnap.data() as any;
        // update group members array and membersCount
        t.update(groupRef, {
          members: admin.firestore.FieldValue.arrayUnion(userId),
          membersCount: admin.firestore.FieldValue.increment(1),
        });

        // update user document to set groupId
        const userRef = db.collection('users').doc(userId);
        t.update(userRef, { groupId: groupId });
      });

      // Also create a members subcollection doc for audit/history
      await groupRef.collection('members').doc(userId).set({ joinedAt: admin.firestore.FieldValue.serverTimestamp() });

      return res.json({ ok: true });
    }

    return res.status(403).json({ error: 'group is private' });
  } catch (err) {
    return res.status(500).json({ error: 'join failed', details: String(err) });
  }
});

// Export as Cloud Function
export const api = functions.https.onRequest(app);

// When running locally (not in Cloud Functions), start an express server
// so `npm run dev` or `ts-node-dev` serves the endpoints at a port.
if (require.main === module) {
  const port = process.env.PORT || 5001;
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend express server listening at http://localhost:${port}`);
  });
}
