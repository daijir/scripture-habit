import { auth } from '../../firebase';
import { toast } from 'react-toastify';
import { useLanguage } from '../../Context/LanguageContext';
import { Capacitor } from '@capacitor/core';

export default function LeaveGroupButton({ groupId }) {
  const { t } = useLanguage();
  const API_BASE = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';

  const handleLeave = async () => {
    const user = auth.currentUser;
    if (!user) return toast.info(t('login.emailLabel') || "Not logged in");

    if (!confirm(t('groupChat.leaveConfirmMessage') || "Are you sure you want to leave this group?")) return;

    try {
      const idToken = await user.getIdToken();

      const response = await fetch(`${API_BASE}/api/leave-group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ groupId })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to leave group');
      }

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
