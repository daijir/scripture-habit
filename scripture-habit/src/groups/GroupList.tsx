import { useEffect, useState } from 'react';
import { getFirestore, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { app } from '../firebase';
import GroupCard from './GroupCard';

type Props = {
  currentUser: { uid: string } | null;
};

export default function GroupList({ currentUser }: Props) {
  const [groups, setGroups] = useState<Array<{ id: string; name: string; description?: string; members?: string[]; lastMessageAt?: unknown; messageCount?: number;[key: string]: unknown }>>([]);
  const db = getFirestore(app);

  useEffect(() => {
    const q = query(collection(db, 'groups'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: Array<{ id: string; name: string; description?: string; members?: string[]; lastMessageAt?: unknown; messageCount?: number;[key: string]: unknown }> = [];
        snap.forEach((d) => items.push({ id: d.id, ...(d.data() as { name: string; description?: string; members?: string[]; lastMessageAt?: unknown; messageCount?: number;[key: string]: unknown }) }));
        setGroups(items);
      },
      (err) => {
        console.error('Failed loading groups', err);
      }
    );
    return () => unsub();
  }, [db]);

  return (
    <div>
      <h3>Groups</h3>
      {groups.length === 0 && <p>No groups yet — create one.</p>}
      {groups.map((g) => (
        <GroupCard key={g.id} group={g} currentUser={currentUser} />
      ))}
    </div>
  );
}
