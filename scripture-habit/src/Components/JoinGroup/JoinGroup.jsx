import './JoinGroup.css';
import { useState, useEffect } from "react";
import { auth, db } from '../../firebase';
import { doc, getDoc, writeBatch, onSnapshot, increment, arrayUnion, collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { onAuthStateChanged } from "firebase/auth";
import '../GroupForm/GroupForm.css';
import Button from '../Button/Button';
import Input from '../Input/Input';
import GroupCard from '../../groups/GroupCard';
import { useLanguage } from '../../Context/LanguageContext';

export default function JoinGroup() {
  const { t } = useLanguage();
  const [groupCode, setGroupCode] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [publicGroups, setPublicGroups] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
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
        const resp = await fetch('/api/groups');
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
      const resp = await fetch('/api/join-group', {
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

  const handleJoinClick = (groupId, groupData) => {
    setSelectedGroup({ id: groupId, ...groupData });
    setShowConfirmModal(true);
  };

  const confirmJoin = async () => {
    if (selectedGroup) {
      await joinGroup(selectedGroup.id, selectedGroup);
      setShowConfirmModal(false);
      setSelectedGroup(null);
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
      {showConfirmModal && (
        <div className="group-modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="group-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '300px', textAlign: 'center' }}>
            <h3>{t('joinGroup.joinConfirmTitle')}</h3>
            <p>{t('joinGroup.joinConfirmMessage')}</p>
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
