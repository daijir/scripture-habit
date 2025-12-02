import { auth, db } from '../../firebase';
import { doc, updateDoc, arrayRemove } from 'firebase/firestore';

export default function LeaveGroupButton({ groupId }) {
  const handleLeave = async () => {
    const user = auth.currentUser;
    if (!user) return alert("Not logged in");

    try {
      
      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, {
        members: arrayRemove(user.uid)
      });

      
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        groupId: null
      });

      alert("You have left the group");
    } catch (err) {
      console.error(err);
      alert("Failed to leave group");
    }
  };

  return (
    <button onClick={handleLeave} className="btn btn-warning">
      Leave Group
    </button>
  );
}
