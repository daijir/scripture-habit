import { useState, useEffect, useRef } from 'react';
import { getFirestore, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { app, auth } from '../firebase';
import './GroupCard.css';

type Props = {
  group: { id: string; name: string; description?: string; members?: string[] };
  currentUser: { uid: string } | null;
  onJoin?: (groupId: string, groupData?: any) => Promise<void> | void;
};

export default function GroupCard({ group, currentUser, onJoin }: Props) {
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
      alert('Unable to join group');
    } finally {
      setJoining(false);
    }
  };

  const [showDetails, setShowDetails] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!showDetails) return;
    // focus the close button when modal opens
    closeBtnRef.current?.focus();

    // save previously focused element to restore when modal closes
    previousActiveElement.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDetails(false);
        return;
      }
      if (e.key === 'Tab') {
        // implement focus trap
        const container = modalRef.current;
        if (!container) return;
        const focusable = Array.from(
          container.querySelectorAll<HTMLElement>(
            'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement);
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first || document.activeElement === modalRef.current) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      // restore focus
      if (previousActiveElement.current) previousActiveElement.current.focus();
    };
  }, [showDetails]);

  return (
    <div className="group-card" role="group" aria-label={`Group ${group.name}`}>
      <div className="group-card-header">
        <h4 className="group-title">{group.name}</h4>
        <div className="member-badge">{group.members?.length ?? 0} members</div>
      </div>

      {group.description && <p className="group-desc">{group.description}</p>}

      <div className="group-actions">
        <button
          className="join-btn"
          onClick={() => {
            if (isMember) setShowDetails(true);
            else handleJoin();
          }}
          disabled={joining}
        >
          {isMember ? 'Open' : joining ? 'Joining...' : 'Join'}
        </button>

        <button className="details-btn" onClick={() => setShowDetails(true)}>
          Details
        </button>
      </div>

      {showDetails && (
        <div
          className="modal-overlay"
          onClick={() => setShowDetails(false)}
          role="presentation"
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`group-${group.id}-title`}
            aria-describedby={`group-${group.id}-desc`}
            ref={modalRef}
          >
            <h3>{group.name}</h3>
            {group.description ? (
              <p id={`group-${group.id}-desc`}>{group.description}</p>
            ) : (
              <p id={`group-${group.id}-desc`}>No description.</p>
            )}
            <p>
              <strong>Members:</strong> {group.members?.length ?? 0}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button
                className="details-btn"
                onClick={() => setShowDetails(false)}
                ref={closeBtnRef}
                aria-label={`Close details for ${group.name}`}
              >
                Close
              </button>
              {!isMember && (
                <button
                  className="join-btn"
                  onClick={async () => {
                    await handleJoin();
                    setShowDetails(false);
                  }}
                >
                  Join
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
