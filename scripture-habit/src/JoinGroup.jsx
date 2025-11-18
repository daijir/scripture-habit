import { useState, useEffect } from "react";
import { auth, db } from './firebase';
import { doc, getDoc, writeBatch } from 'firebase/firestore'; // Removed 'increment'
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from "firebase/auth";

export default function JoinGroup() {
  const [groupCode, setGroupCode] = useState(""); // This will be the Group ID
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserData(userSnap.data());
        }
      }
    });
    return () => unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!user) {
      setError("You must be logged in to join a group.");
      return;
    }

    if (userData && userData.groupId) {
      setError("You are already in a group. Please leave your current group first.");
      return;
    }

    if (groupCode.trim() === "") {
      setError("Please enter a Group ID.");
      return;
    }

    const groupRef = doc(db, "groups", groupCode.trim());
    const userRef = doc(db, "users", user.uid);

    try {
      const groupSnap = await getDoc(groupRef);

      if (!groupSnap.exists()) {
        setError("Group not found. Please check the ID and try again.");
        return;
      }

      const groupData = groupSnap.data();

      if (groupData.members.includes(user.uid)) {
        setError("You are already a member of this group.");
        return;
      }

      if (groupData.membersCount >= groupData.maxMembers) {
        setError("This group is already full.");
        return;
      }

      // Use a batch to perform atomic writes
      const batch = writeBatch(db);

      // 1. Update group: add user to members array and increment membersCount
      batch.update(groupRef, {
        members: [...groupData.members, user.uid],
        membersCount: groupData.membersCount + 1 // Use client-side calculation
      });

      // 2. Update user: set their groupId
      batch.update(userRef, {
        groupId: groupSnap.id
      });

      await batch.commit();

      alert(`Successfully joined group: ${groupData.name}`);
      navigate('/dashboard');

    } catch (e) {
      console.error("Error joining group:", e);
      setError("Failed to join group. Please try again.");
    }
  }

  return (
    <div className="group-page">
      <div className="group-card">
        <h1>Join a Group</h1>
        <p className="subtitle">
          Enter the Group ID to join a scripture study group.
        </p>

        <form onSubmit={handleSubmit} className="group-form">
          <label>Group ID</label>
          <input
            type="text"
            placeholder="Enter Group ID"
            value={groupCode}
            onChange={(e) => setGroupCode(e.target.value)}
            required
          />

          {error && <p className="error">{error}</p>}

          <button type="submit" className="create-btn">
            Join Group
          </button>
        </form>
      </div>
    </div>
  );
}
