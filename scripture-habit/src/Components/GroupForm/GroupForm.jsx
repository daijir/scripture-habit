import './GroupForm.css';
import { useState } from "react";
import { auth, db } from '../../firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Input from '../Input/Input';
import Button from '../Button/Button';

export default function GroupForm() {
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState(5);
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const user = auth.currentUser;
    if (!user) {
      setError("You must be logged in to create a group.");
      return;
    }

    try {
      const now = new Date();
      const newGroupData = {
        name: groupName,
        description: description,
        createdAt: now,
        groupStreak: 0, // Default initial streak
        inviteCode: "", // Can be generated later or left empty
        isPublic: isPublic,
        maxMembers: Number(maxMembers),
        membersCount: 1, // Creator is the first member
        ownerUserId: user.uid,
        members: [user.uid], // Add creator to members array
      };

      // 1. Create new group document in Firestore
      const docRef = await addDoc(collection(db, 'groups'), newGroupData);
      const newGroupId = docRef.id;

      // 2. Update the current user's document with the new groupId
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        groupId: newGroupId,
      });

      alert(`Group Created: ${groupName}`);
      navigate('/dashboard'); // Redirect to dashboard after creation

    } catch (e) {
      console.error("Error creating group or updating user:", e);
      setError("Failed to create group. Please try again.");
    }
  }

  return (
    <div className="App GroupForm">
      <div className="AppGlass">
        <h1>Create a Study Group</h1>
        <p className="subtitle">
          Build a scripture study group and invite others to join.
        </p>

        <form onSubmit={handleSubmit} className="group-form">
          <Input
            label = "Group Name"
            type="text"
            placeholder="Enter group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            required
          />
          <Input
            label="Description (optional)"
            as="textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <Input
            label="Max Members"
            value={maxMembers}
            onChange={(e) => setMaxMembers(e.target.value)}
            min="2" // Minimum 2 members for a group
            required
          />

          <div className="checkbox-container">
            <input
              type="checkbox"
              id="isPublic"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            <label htmlFor="isPublic">Public Group</label>
          </div>

          <Button type="submit" style={{marginTop:24}}>
            Create Group
          </Button>
        </form>
        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
}
