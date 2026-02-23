import React, { useState } from 'react';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { app } from '../firebase';
import { toast } from 'react-toastify';
import { useLanguage } from '../Context/LanguageContext';

type Props = {
  currentUser: { uid: string; displayName?: string } | null;
  onCreated?: (groupId: string) => void;
};

export default function GroupCreate({ currentUser, onCreated }: Props) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const db = getFirestore(app);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      toast.error(t('groupForm.errorLoggedIn') || 'Please sign in to create a group');
      return;
    }
    if (!name.trim()) {
      toast.error(t('groupForm.groupNamePlaceholder') || 'Please enter a group name');
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
      toast.success(t('groupForm.successCreated') || 'Group created successfully!');
      onCreated?.(docRef.id);
    } catch (err: unknown) {
      console.error('Failed to create group', err);
      toast.error(t('groupForm.errorCreateFailed') || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleCreate} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <h3>{t('groupForm.title')}</h3>
      <div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('groupForm.groupNamePlaceholder')} />
      </div>
      <div>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('groupForm.descriptionLabel')} />
      </div>
      <div>
        <button type="submit" disabled={loading}>{loading ? t('newNote.saving') : t('groupForm.createButton')}</button>
      </div>
    </form>
  );
}
