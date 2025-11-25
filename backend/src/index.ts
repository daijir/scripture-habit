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

// Determine whether we have credentials or an emulator configured. If not,
// fall back to a lightweight in-memory mock so local development can continue
// without access to the real Firebase project.
const hasCredentials = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIRESTORE_EMULATOR_HOST);
if (!hasCredentials) {
  // eslint-disable-next-line no-console
  console.warn('firebase-admin credentials/emulator not detected — using in-memory mock for Firestore.');
}

const db = hasCredentials ? admin.firestore() : null as unknown as FirebaseFirestore.Firestore;

// Simple in-memory mock data used when credentials are not available.
const mockGroups: Record<string, any> = {
  'mock-group-1': {
    id: 'mock-group-1',
    name: 'Public Test Group',
    description: 'A seeded public group for local development',
    isPublic: true,
    membersCount: 1,
    members: ['mock-user-1'],
    ownerId: 'mock-user-1',
    createdAt: new Date().toISOString(),
  },
  'mock-group-2': {
    id: 'mock-group-2',
    name: 'Nearly Full Group',
    description: 'Used to test membersCount filtering',
    isPublic: true,
    membersCount: 4,
    members: ['u1','u2','u3','u4'],
    ownerId: 'u1',
    createdAt: new Date().toISOString(),
  },
};
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
    // If credentials/emulator are not available, return mocked groups for local dev
    if (!hasCredentials) {
      let resGroups = Object.values(mockGroups);
      if (typeof membersCountLt === 'number' && !Number.isNaN(membersCountLt)) {
        resGroups = resGroups.filter((g: any) => (g.membersCount ?? 0) < membersCountLt);
      }
      return res.json(resGroups);
    }

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
  // In mock mode (no credentials), accept a relaxed token to make local dev easy.
  if (!hasCredentials) {
    const authHeader = (req.headers.authorization || req.headers.Authorization) as string | undefined;
    if (authHeader && authHeader.startsWith('Bearer mock:')) {
      req.userUid = authHeader.split(':')[1];
      return next();
    }
    // allow an explicit header `x-mock-user` or fall back to a default mock user
    const mockUser = req.headers['x-mock-user'] || 'mock-user-1';
    req.userUid = String(mockUser);
    return next();
  }

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
    // If we're running without credentials, operate on the in-memory mock
    if (!hasCredentials) {
      const g = mockGroups[groupId];
      if (!g) return res.status(404).json({ error: 'group not found (mock)' });
      const data = g as any;

      if (data?.isPublic || data?.public) {
        const isAlreadyMember = Array.isArray(data.members) && data.members.includes(userId);
        if (isAlreadyMember) return res.status(200).json({ ok: true, message: 'already a member (mock)' });
        data.members = Array.isArray(data.members) ? [...data.members, userId] : [userId];
        data.membersCount = (data.membersCount || 0) + 1;
        mockGroups[groupId] = data;
        return res.json({ ok: true, mock: true });
      }
      return res.status(403).json({ error: 'group is private (mock)' });
    }

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
