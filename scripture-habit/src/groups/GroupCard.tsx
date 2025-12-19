import { useState } from 'react';

import { getFirestore, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { app, auth } from '../firebase';
import './GroupCard.css';
import { useLanguage } from '../Context/LanguageContext';

type Props = {
  group: { id: string; name: string; description?: string; members?: string[]; lastMessageAt?: any; messageCount?: number };
  currentUser: { uid: string } | null;
  onJoin?: (groupId: string, groupData?: any) => Promise<void> | void;
  onOpen?: (group: any) => void;
};

export default function GroupCard({ group, currentUser, onJoin, onOpen }: Props) {
  const { t } = useLanguage();

  const [joining, setJoining] = useState(false);
  const db = getFirestore(app);

  const isMember = !!(group.members && currentUser && group.members.includes(currentUser.uid));

  const getActivityStatus = () => {
    const now = new Date();
    const ONE_HOUR = 1000 * 60 * 60;

    // 1. Check Message Activity
    let lastDate = null;
    if (group.lastMessageAt) {
      if (group.lastMessageAt.toDate) lastDate = group.lastMessageAt.toDate();
      else if (group.lastMessageAt.seconds) lastDate = new Date(group.lastMessageAt.seconds * 1000);
      else if (group.lastMessageAt._seconds) lastDate = new Date(group.lastMessageAt._seconds * 1000);
      else lastDate = new Date(group.lastMessageAt);
    }

    if (lastDate && !isNaN(lastDate.getTime())) {
      const diffHours = (now.getTime() - lastDate.getTime()) / ONE_HOUR;
      if (diffHours <= 24) return { label: t('groupCard.statusActive'), color: '#ff5722', bg: '#fbe9e7' };
      return { label: t('groupCard.statusRelaxed'), color: '#795548', bg: '#efebe9' };
    }

    // 2. No messages? Check New (Created < 48h)
    let createdDate = null;
    const g = group as any;
    if (g.createdAt) {
      if (g.createdAt.toDate) createdDate = g.createdAt.toDate();
      else if (g.createdAt.seconds) createdDate = new Date(g.createdAt.seconds * 1000);
      else if (g.createdAt._seconds) createdDate = new Date(g.createdAt._seconds * 1000);
      else createdDate = new Date(g.createdAt);
    }

    if (createdDate && !isNaN(createdDate.getTime())) {
      const createdHours = (now.getTime() - createdDate.getTime()) / ONE_HOUR;
      if (createdHours <= 48) return { label: t('groupCard.statusNew'), color: '#4caf50', bg: '#e8f5e9' };
    }

    // Fallback
    if (!lastDate && !createdDate) return { label: t('groupCard.statusNew'), color: '#4caf50', bg: '#e8f5e9' };

    return { label: t('groupCard.statusRelaxed'), color: '#795548', bg: '#efebe9' };
  };

  const activity = getActivityStatus();

  const handleJoin = async () => {
    if (!currentUser) {
      alert(t('groupCard.signInFirst'));
      return;
    }
    if (isMember) return;
    setJoining(true);
    try {
      // If an external join handler is provided (e.g. JoinGroup.joinGroup), prefer that
      if (onJoin) {
        await onJoin(group.id, group);
        return;
      }
      const backend = import.meta.env.VITE_BACKEND_URL ?? '/api';
      const idToken = await auth.currentUser?.getIdToken();
      if (idToken) {
        const res = await fetch(`${backend}/join-group`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ groupId: group.id }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || 'Server join failed');
        }
      } else {
        const groupRef = doc(db, 'groups', group.id);
        await updateDoc(groupRef, { members: arrayUnion(currentUser.uid) });
      }
    } catch (err) {
      console.error('Join failed', err);
      alert(t('groupCard.unableToJoin'));
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="group-card" role="group" aria-label={`Group ${group.name}`}>
      <div className="group-card-header">
        <h4 className="group-title">{group.name}</h4>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
          <div
            className="activity-badge"
            style={{
              backgroundColor: activity.bg,
              color: activity.color,
              padding: '0.3rem 0.6rem',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center'
            }}
          >
            {activity.label}
          </div>
          <div className="member-badge">{group.members?.length ?? 0} {t('groupCard.members')}</div>
        </div>
      </div>

      <div className="group-actions">
        <button
          className="join-btn"
          onClick={() => {
            if (isMember) {
              if (onOpen) onOpen(group);
            }
            else handleJoin();
          }}
          disabled={joining}
        >
          {joining ? t('groupCard.joining') : t('groupCard.details')}
        </button>
      </div>
    </div>
  );
}
