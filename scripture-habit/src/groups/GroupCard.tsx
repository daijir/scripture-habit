import React, { useState } from 'react';
import { getFirestore, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { app } from '../firebase';

type Props = {
  group: { id: string; name: string; description?: string; members?: string[] };
  currentUser: { uid: string } | null;
};

export default function GroupCard({ group, currentUser }: Props) {
  const [joining, setJoining] = useState(false);
  const db = getFirestore(app);

  const isMember = !!(group.members && currentUser && group.members.includes(currentUser.uid));

  const handleJoin = async () => {
    if (!currentUser) {
      alert('Sign in first to join groups');
      return;
    }
    if (isMember) return;
    setJoining(true);
    try {
      const groupRef = doc(db, 'groups', group.id);
      await updateDoc(groupRef, { members: arrayUnion(currentUser.uid) });
    } catch (err) {
      console.error('Join failed', err);
      alert('Unable to join group');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div style={{ border: '1px solid #ccc', padding: 10, marginBottom: 8, borderRadius: 6 }}>
      <h4>{group.name}</h4>
      {group.description && <p>{group.description}</p>}
      <div>
        <small>Members: {group.members?.length ?? 0}</small>
      </div>
      <div>
        <button onClick={handleJoin} disabled={isMember || joining}>
          {isMember ? 'Joined' : joining ? 'Joining...' : 'Join'}
        </button>
      </div>
    </div>
  );
}
