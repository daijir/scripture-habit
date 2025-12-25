import { auth, db } from '../../firebase';
import { doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { useLanguage } from '../../Context/LanguageContext';

export default function LeaveGroupButton({ groupId }) {
  const { t } = useLanguage();

  const handleLeave = async () => {
    const user = auth.currentUser;
    if (!user) return toast.info(t('login.emailLabel') || "Not logged in");

    if (!confirm(t('groupChat.leaveConfirmMessage') || "Are you sure you want to leave this group?")) return;

    try {
      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, {
        members: arrayRemove(user.uid)
      });

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        groupId: null
      });

      toast.success(t('groupChat.leftGroupSuccess') || "You have left the group");
      window.location.href = '/dashboard';
    } catch (err) {
      console.error(err);
      toast.error(t('groupChat.errorLeaveGroup') || "Failed to leave group");
    }
  };

  return (
    <button onClick={handleLeave} className="btn btn-warning">
      {t('groupChat.leaveGroup')}
    </button>
  );
}
