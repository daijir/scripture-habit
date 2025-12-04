import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFirestore, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { app, auth } from '../firebase';
import './GroupCard.css';
import { useLanguage } from '../Context/LanguageContext';

type Props = {
  group: { id: string; name: string; description?: string; members?: string[] };
  currentUser: { uid: string } | null;
  onJoin?: (groupId: string, groupData?: any) => Promise<void> | void;
};

export default function GroupCard({ group, currentUser, onJoin }: Props) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);
  const db = getFirestore(app);

  const isMember = !!(group.members && currentUser && group.members.includes(currentUser.uid));

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
        <div className="member-badge">{group.members?.length ?? 0} {t('groupCard.members')}</div>
      </div>

      {group.description && <p className="group-desc">{group.description}</p>}

      <div className="group-actions">
        <button
          className="join-btn"
          onClick={() => {
            if (isMember) {
              navigate('/dashboard', { state: { initialView: 2, initialGroupId: group.id } });
            }
            else handleJoin();
          }}
          disabled={joining}
        >
          {isMember ? t('groupCard.open') : joining ? t('groupCard.joining') : t('groupCard.join')}
        </button>
      </div>
    </div>
  );
}
