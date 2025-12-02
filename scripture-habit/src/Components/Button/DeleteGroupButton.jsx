import { auth, db } from '../../firebase';
import { doc, deleteDoc } from 'firebase/firestore';

export default function DeleteGroupButton({ groupId, ownerUserId }) {
  const handleDelete = async () => {
    const user = auth.currentUser;
    if (!user || user.uid !== ownerUserId) {
      return alert("Only the group owner can delete this group");
    }

    if (!confirm("Are you sure you want to delete this group?")) return;

    try {
      await deleteDoc(doc(db, 'groups', groupId));
      alert("Group deleted");
          
    } catch (err) {
      console.error(err);
      alert("Failed to delete group");
    }
  };

  return (
    <button onClick={handleDelete} className="btn btn-danger">
      Delete Group
    </button>
  );
}
