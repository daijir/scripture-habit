import './JoinGroup.css';
import { Capacitor } from '@capacitor/core';
import { useState, useEffect } from "react";
import { auth, db } from '../../firebase';
import { doc, getDoc, writeBatch, onSnapshot, increment, arrayUnion, collection, query, where, getDocs, getCountFromServer } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { onAuthStateChanged } from "firebase/auth";
import '../GroupForm/GroupForm.css';
import Button from '../Button/Button';
import Input from '../Input/Input';
import GroupCard from '../../groups/GroupCard';
import { useLanguage } from '../../Context/LanguageContext';
import UserProfileModal from '../UserProfileModal/UserProfileModal';
import Mascot from '../Mascot/Mascot';

export default function JoinGroup() {
  const { t } = useLanguage();
  const API_BASE = Capacitor.isNativePlatform() ? 'https://scripture-habit.vercel.app' : '';
  const [groupCode, setGroupCode] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [publicGroups, setPublicGroups] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedMemberForProfile, setSelectedMemberForProfile] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let userDocUnsubscribe = () => { };
    const authUnsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        userDocUnsubscribe = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          }
        });
      }
    });

    const fetchPublicGroups = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/groups`);
        if (resp.ok) {
          const groups = await resp.json();
          setPublicGroups(groups || []);
          return;
        }
        console.warn('Backend /groups returned', resp.status);
      } catch (e) {
        console.warn('Backend /groups fetch failed, falling back to client query:', e);
      }

      try {
        const q = query(
          collection(db, 'groups'),
          where('isPublic', '==', true)
        );
        const querySnapshot = await getDocs(q);
        const groups = [];
        querySnapshot.forEach((doc) => {
          groups.push({ id: doc.id, ...doc.data() });
        });
        setPublicGroups(groups);
      } catch (e) {
        console.error('Error fetching public groups (composite query fallback):', e);
        setPublicGroups([]);
      }
    };
    fetchPublicGroups();

    return () => { authUnsubscribe(); userDocUnsubscribe(); };
  }, []);

  const joinGroup = async (groupId, groupData) => {
    if (!user) {
      setError(t('joinGroup.errorLoggedIn'));
      return;
    }

    const currentGroupIds = userData?.groupIds || (userData?.groupId ? [userData.groupId] : []);

    if (currentGroupIds.length >= 12) {
      setError(t('joinGroup.errorMaxGroups'));
      return;
    }

    if (currentGroupIds.includes(groupId)) {
      setError(t('joinGroup.errorAlreadyMember'));
      return;
    }

    if (groupData.members && groupData.members.includes(user.uid)) {
      setError(t('joinGroup.errorAlreadyMember'));
      return;
    }

    if (groupData.membersCount >= groupData.maxMembers) {
      setError(t('joinGroup.errorFull'));
      return;
    }

    try {
      const idToken = await user.getIdToken();
      const resp = await fetch(`${API_BASE}/api/join-group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ groupId })
      });
      if (resp.ok) {
        alert(`${t('joinGroup.successJoined')} ${groupData.name}`);
        navigate('/dashboard', { state: { initialGroupId: groupId, showWelcome: true, initialView: 2 } });
        return;
      }
      const errText = await resp.text();
      console.warn('Server join failed:', resp.status, errText);
      setError(`${t('joinGroup.errorJoinFailed')} ${errText}`);
    } catch (e) {
      console.warn('Server join failed, falling back to client update:', e);
      // Fallback logic
      const groupRef = doc(db, "groups", groupId);
      const userRef = doc(db, "users", user.uid);
      const batch = writeBatch(db);

      try {
        batch.update(groupRef, {
          members: arrayUnion(user.uid),
          membersCount: increment(1)
        });
        batch.update(userRef, {
          groupIds: arrayUnion(groupId),
          groupId: groupId // Set as active
        });
        await batch.commit();
        alert(`${t('joinGroup.successJoined')} ${groupData.name}`);
        navigate('/dashboard', { state: { initialGroupId: groupId, showWelcome: true, initialView: 2 } });
      } catch (e) {
        console.error("Error joining group:", e);
        setError(t('joinGroup.errorJoinFailed'));
      }
    }
  };

  const [memberNames, setMemberNames] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [groupNoteCount, setGroupNoteCount] = useState(0);

  const handleJoinClick = async (groupId, groupData) => {
    setSelectedGroup({ id: groupId, ...groupData });
    setShowConfirmModal(true);
    setMemberNames([]); // Reset
    setLoadingMembers(true);
    setGroupNoteCount(groupData.noteCount || 0);

    if (groupData.members && groupData.members.length > 0) {
      try {
        // Fetch up to 10 members for preview to avoid excessive reads/latency, or just fetch all since groups are small
        const memberIds = groupData.members.slice(0, 20);
        const names = await Promise.all(memberIds.map(async (uid) => {
          try {
            const uSnap = await getDoc(doc(db, 'users', uid));
            if (uSnap.exists()) {
              return { uid, ...uSnap.data() };
            }
          } catch (e) {
            console.warn("Failed to fetch user", uid);
          }
          return null;
        }));
        setMemberNames(names.filter(n => n));
      } catch (e) {
        console.error("Error fetching member names:", e);
      }
    }
    setLoadingMembers(false);
  };

  const confirmJoin = async () => {
    if (selectedGroup) {
      await joinGroup(selectedGroup.id, selectedGroup);
      setShowConfirmModal(false);
      setSelectedGroup(null);
      setMemberNames([]);
    }
  };

  const handleOpenGroup = (groupId) => {
    navigate('/dashboard', { state: { initialGroupId: groupId, showWelcome: false, initialView: 2 } });
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (groupCode.trim() === "") {
      setError(t('joinGroup.errorEnterCode'));
      return;
    }

    const q = query(collection(db, 'groups'), where('inviteCode', '==', groupCode.trim()));

    try {
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        setError(t('joinGroup.errorInvalidCode'));
        return;
      }

      const groupDoc = querySnapshot.docs[0];
      const groupData = groupDoc.data();

      // For invite code join, we can also show confirmation or just join directly.
      // Assuming direct join for invite code is fine as user explicitly typed code.
      await joinGroup(groupDoc.id, groupData);

    } catch (e) {
      console.error("Error finding group:", e);
      setError(t('joinGroup.errorSearch'));
    }
  }

  return (
    <div className="App">
      <div className="AppGlass join-group-container">
        <div className="group-card-section">
          <div className="section-header">
            <h2>{t('joinGroup.inviteCodeTitle')}</h2>
            <p>{t('joinGroup.inviteCodeDesc')}</p>
          </div>

          <form onSubmit={handleSubmit}>
            <Input
              label={t('joinGroup.inviteCodeLabel')}
              id="inviteCode"
              type="text"
              placeholder={t('joinGroup.inviteCodePlaceholder')}
              value={groupCode}
              onChange={(e) => setGroupCode(e.target.value.toUpperCase())}
              required
            />
            {error && <p className="error">{error}</p>}

            <Button type="submit" className="invite-join-btn">
              {t('joinGroup.joinButton')}
            </Button>
          </form>
        </div>

        <Mascot
          userData={userData}
          customMessage={t('mascot.groupOptionsPrompt')}
          reversed={true}
        />

        <div className="public-groups-section">
          <div className="section-header">
            <h2>{t('joinGroup.publicGroupsTitle')}</h2>
            <p>{t('joinGroup.publicGroupsDesc')}</p>
          </div>

          {publicGroups.length === 0 ? (
            <p className="no-groups-message">{t('joinGroup.noPublicGroups')}</p>
          ) : (
            <div className="groups-grid">
              {publicGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  currentUser={user}
                  onJoin={() => handleJoinClick(group.id, group)}
                  onOpen={() => handleOpenGroup(group.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="create-group-cta">
          <p>{t('joinGroup.createGroupCta')}</p>
          <Link to="/group-form" className="create-group-link">{t('joinGroup.createGroupLink')}</Link>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1rem', width: '100%' }}>
          <Link to="/dashboard" className="back-link">
            {t('groupOptions.backToDashboard')}
          </Link>
        </div>

      </div>

      {/* Join Confirmation Modal */}
      {showConfirmModal && selectedGroup && (
        <div className="group-modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="group-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h3>{selectedGroup.name}</h3>
            {selectedGroup.description && (
              <p style={{ color: '#718096', marginBottom: '1rem', fontStyle: 'italic' }}>
                {selectedGroup.description}
              </p>
            )}

            <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem' }}>
                <h4 style={{ fontSize: '0.9rem', color: '#4A5568', margin: 0 }}>
                  {t('groupChat.members')} ({selectedGroup.membersCount || 0})
                </h4>
                <span style={{ fontSize: '0.8rem', color: '#718096', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '1rem' }}>📄</span> {groupNoteCount} {t('joinGroup.notes')}
                </span>
              </div>
              {loadingMembers ? (
                <p style={{ fontSize: '0.8rem', color: '#718096' }}>Loading members...</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {memberNames.length > 0 ? (
                    memberNames.map((userObj, idx) => (
                      <span
                        key={idx}
                        onClick={() => setSelectedMemberForProfile(userObj)}
                        style={{
                          backgroundColor: '#EDF2F7',
                          color: '#4A5568',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s',
                          border: '1px solid transparent'
                        }}
                        onMouseOver={(e) => e.target.style.borderColor = '#cbd5e0'}
                        onMouseOut={(e) => e.target.style.borderColor = 'transparent'}
                      >
                        {userObj.nickname || 'Unknown'}
                      </span>
                    ))
                  ) : (
                    <p style={{ fontSize: '0.8rem', color: '#718096' }}>None</p>
                  )}
                </div>
              )}
            </div>

            {/* Profile Modal inside Confirm Modal */}
            {selectedMemberForProfile && (
              <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 3000 }}>
                <UserProfileModal
                  user={selectedMemberForProfile}
                  onClose={() => setSelectedMemberForProfile(null)}
                />
              </div>
            )}

            <p style={{ marginBottom: '1.5rem' }}>{t('joinGroup.joinConfirmMessage')}</p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
              <button
                className="close-modal-btn"
                onClick={() => setShowConfirmModal(false)}
                style={{ marginTop: 0, flex: 1 }}
              >
                {t('joinGroup.cancelJoin')}
              </button>
              <button
                className="close-modal-btn confirm-join-btn"
                onClick={confirmJoin}
                style={{
                  marginTop: 0,
                  flex: 1
                }}
              >
                {t('joinGroup.confirmJoin')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
