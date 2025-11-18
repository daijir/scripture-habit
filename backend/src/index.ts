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

// Return public groups
app.get('/groups', async (_req, res) => {
  try {
    const snap = await db.collection('groups').where('public', '==', true).get();
    const groups = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: 'failed to fetch groups', details: String(err) });
  }
});

// Join a group (simple validation). Expects { groupId, userId }
app.post('/join-group', async (req, res) => {
  const { groupId, userId } = req.body;
  if (!groupId || !userId) return res.status(400).json({ error: 'groupId and userId required' });

  try {
    const groupRef = db.collection('groups').doc(groupId);
    const g = await groupRef.get();
    if (!g.exists) return res.status(404).json({ error: 'group not found' });
    const data = g.data() as any;

    // If group is public, allow join. Private groups require invite (not implemented yet).
    if (data?.public) {
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
