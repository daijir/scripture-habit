import React, { useState } from 'react';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { app } from '../firebase';

type Props = {
  currentUser: { uid: string; displayName?: string } | null;
  onCreated?: (groupId: string) => void;
};

export default function GroupCreate({ currentUser, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const db = getFirestore(app);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      alert('Please sign in to create a group');
      return;
    }
    if (!name.trim()) {
      alert('Please enter a group name');
      return;
    }
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'groups'), {
        name: name.trim(),
        description: description.trim() || null,
        createdBy: currentUser.uid,
        members: [currentUser.uid],
        createdAt: serverTimestamp(),
      });
      setName('');
      setDescription('');
      onCreated?.(docRef.id);
    } catch (err) {
      console.error('Failed to create group', err);
      alert('Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleCreate} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <h3>Create Group</h3>
      <div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" />
      </div>
      <div>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" />
      </div>
      <div>
        <button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Group'}</button>
      </div>
    </form>
  );
}
