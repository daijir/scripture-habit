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

export default function JoinGroup() {
  const [groupCode, setGroupCode] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [publicGroups, setPublicGroups] = useState([]);
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
        const resp = await fetch('/api/groups?membersCountLt=5');
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
          where('isPublic', '==', true),
          where('membersCount', '<', 5)
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
      setError("You must be logged in to join a group.");
      return;
    }
    if (userData && userData.groupId) {
      setError("You are already in a group. Please leave your current group first.");
      return;
    }

    if (groupData.members && groupData.members.includes(user.uid)) {
      setError("You are already a member of this group.");
      return;
    }

    if (groupData.membersCount >= groupData.maxMembers) {
      setError("This group is already full.");
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
        alert(`Successfully joined group: ${groupData.name}`);
        navigate('/dashboard');
        return;
      }
      const errText = await resp.text();
      console.warn('Server join failed:', resp.status, errText);
    } catch (e) {
      console.warn('Server join failed, falling back to client update:', e);
    }

    const groupRef = doc(db, "groups", groupId);
    const userRef = doc(db, "users", user.uid);
    const batch = writeBatch(db);

    try {
      batch.update(groupRef, {
        members: arrayUnion(user.uid),
        membersCount: increment(1)
      });
      batch.update(userRef, {
        groupId: groupId
      });
      await batch.commit();
      alert(`Successfully joined group: ${groupData.name}`);
      navigate('/dashboard');
    } catch (e) {
      console.error("Error joining group:", e);
      setError("Failed to join group. Please try again.");
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (groupCode.trim() === "") {
      setError("Please enter an Invite Code.");
      return;
    }

    const q = query(collection(db, 'groups'), where('inviteCode', '==', groupCode.trim()));

    try {
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        setError("Invalid invite code. Group not found.");
        return;
      }

      const groupDoc = querySnapshot.docs[0];
      const groupData = groupDoc.data();

      await joinGroup(groupDoc.id, groupData);

    } catch (e) {
      console.error("Error finding group:", e);
      setError("Error searching for group.");
    }
  }

  return (
    <div className="App">
      <div className="AppGlass join-group-container">
        <div className="group-card-section">
          <div className="section-header">
            <h2>Have an Invite Code?</h2>
            <p>Enter the code shared by your group leader to join directly.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <Input
              label="Invite Code"
              id="inviteCode"
              type="text"
              placeholder="e.g. X9J2KL"
              value={groupCode}
              onChange={(e) => setGroupCode(e.target.value.toUpperCase())}
              required
            />
            {error && <p className="error">{error}</p>}

            <Button type="submit">
              Join Group
            </Button>
          </form>
        </div>

        <div className="public-groups-section">
          <div className="section-header">
            <h2>Explore Public Groups</h2>
            <p>Find a community that matches your study goals.</p>
          </div>

          {publicGroups.length === 0 ? (
            <p className="no-groups-message">No public groups available to join.</p>
          ) : (
            <div className="groups-grid">
              {publicGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  currentUser={user}
                  onJoin={async (groupId, groupData) => await joinGroup(groupId, groupData)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="create-group-cta">
          <p>Want to start your own community?</p>
          <Link to="/group-form" className="create-group-link">Create a Group</Link>
        </div>

      </div>
    </div>
  );
}
