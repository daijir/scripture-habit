import './GroupForm.css';
import { useState } from "react";
import { auth, db } from '../../firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import Input from '../Input/Input';
import Button from '../Button/Button';
import Checkbox from '../Input/Checkbox';
import { toast } from "react-toastify";



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
      
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const newGroupData = {
        name: groupName,
        description: description,
        createdAt: now,
        groupStreak: 0, 
        inviteCode: inviteCode,
        isPublic: isPublic,
        maxMembers: Number(maxMembers),
        membersCount: 1, 
        ownerUserId: user.uid,
        members: [user.uid], 
      };

      
      const docRef = await addDoc(collection(db, 'groups'), newGroupData);
      const newGroupId = docRef.id;

      
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        groupId: newGroupId,
      });

      toast.success(`🎉 Group "${groupName}" created successfully!`);
      navigate('/dashboard'); 

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
            label="Group Name"
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
            min="2" 
            required
          />

          <Checkbox
            label="Public Group"
            id="isPublic"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />

          <Button type="submit">
            Create Group
          </Button>
        </form>
        {error && <p className="error-message">{error}</p>}

        <div className="join-group-cta">
          <p>Looking for an existing group?</p>
          <Link to="/join-group" className="join-group-link">Join a Group</Link>
        </div>
      </div>
    </div>
  );
}
