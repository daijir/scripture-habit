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
      const idToken = await user.getIdToken();
      const response = await fetch('/api/delete-group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ groupId })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      alert("Group deleted successfully");
      window.location.href = '/dashboard';

    } catch (err) {
      console.error(err);
      alert("Failed to delete group: " + err.message);
    }
  };

  return (
    <button onClick={handleDelete} className="btn btn-danger">
      Delete Group
    </button>
  );
}
