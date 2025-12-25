import { auth } from '../../firebase';
import { toast } from 'react-toastify';
import { useLanguage } from '../../Context/LanguageContext';

export default function DeleteGroupButton({ groupId, ownerUserId }) {
  const { t } = useLanguage();

  const handleDelete = async () => {
    const user = auth.currentUser;
    if (!user || user.uid !== ownerUserId) {
      return toast.error(t('groupChat.errorOnlyOwnerDelete') || "Only the group owner can delete this group");
    }

    if (!confirm(t('groupChat.deleteMessageConfirm') || "Are you sure you want to delete this group?")) return;

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

      toast.success(t('groupChat.groupDeletedSuccess') || "Group deleted successfully");
      window.location.href = '/dashboard';

    } catch (err) {
      console.error(err);
      toast.error(`${t('groupChat.errorDeleteGroup') || "Failed to delete group"}: ${err.message}`);
    }
  };

  return (
    <button onClick={handleDelete} className="btn btn-danger">
      {t('groupChat.deleteGroup')}
    </button>
  );
}
