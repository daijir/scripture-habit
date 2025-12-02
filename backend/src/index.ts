import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

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

app.get('/health', (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

app.get('/groups', (req, res) => {
  const membersCountLt = req.query?.membersCountLt ? Number(req.query.membersCountLt) : undefined;
  let groups = Object.values(mockGroups);
  if (typeof membersCountLt === 'number' && !Number.isNaN(membersCountLt)) {
    groups = groups.filter((g: any) => (g.membersCount ?? 0) < membersCountLt);
  }
  res.json(groups);
});

// Simple mock verification: accepts header Authorization: Bearer mock:<uid>
function mockVerify(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization as string | undefined;
  if (authHeader && authHeader.startsWith('Bearer mock:')) {
    req.userUid = authHeader.split(':')[1];
    return next();
  }
  // default mock user
  req.userUid = 'mock-user-1';
  return next();
}

app.post('/join-group', mockVerify, (req, res) => {
  const { groupId } = req.body;
  const userId = req.userUid as string | undefined;
  if (!groupId) return res.status(400).json({ error: 'groupId required' });
  if (!userId) return res.status(401).json({ error: 'authentication required' });

  const g = mockGroups[groupId];
  if (!g) return res.status(404).json({ error: 'group not found (mock)' });
  if (!(g.isPublic || g.public)) return res.status(403).json({ error: 'group is private (mock)' });
  if (Array.isArray(g.members) && g.members.includes(userId)) return res.json({ ok: true, message: 'already member (mock)' });

  g.members = Array.isArray(g.members) ? [...g.members, userId] : [userId];
  g.membersCount = (g.membersCount || 0) + 1;
  mockGroups[groupId] = g;
  return res.json({ ok: true, mock: true });
});

const port = process.env.PORT || 5001;
app.listen(port, () => console.log(`Backend mock server listening at http://localhost:${port}`));
