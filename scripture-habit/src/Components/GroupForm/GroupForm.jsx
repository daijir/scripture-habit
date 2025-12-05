import './GroupForm.css';
import { useState } from "react";
import { auth, db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import Input from '../Input/Input';
import Button from '../Button/Button';
import Checkbox from '../Input/Checkbox';
import { toast } from "react-toastify";
import { useLanguage } from '../../Context/LanguageContext';

export default function GroupForm() {
  const { t } = useLanguage();
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState(100000);
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const user = auth.currentUser;
    if (!user) {
      setError(t('groupForm.errorLoggedIn'));
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
        messageCount: 0,
        ownerUserId: user.uid,
        members: [user.uid],
      };


      const docRef = await addDoc(collection(db, 'groups'), newGroupData);
      const newGroupId = docRef.id;


      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        groupIds: arrayUnion(newGroupId),
        groupId: newGroupId, // Set as active
      });

      toast.success(`🎉 ${t('groupForm.successCreated')}`);
      navigate('/dashboard');

    } catch (e) {
      console.error("Error creating group or updating user:", e);
      setError(t('groupForm.errorCreateFailed'));
    }
  }

  return (
    <div className="App GroupForm">
      <div className="AppGlass">
        <h1>{t('groupForm.title')}</h1>
        <p className="subtitle">
          {t('groupForm.subtitle')}
        </p>

        <form onSubmit={handleSubmit} className="group-form">
          <Input
            label={t('groupForm.groupNameLabel')}
            type="text"
            placeholder={t('groupForm.groupNamePlaceholder')}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            required
          />
          <Input
            label={t('groupForm.descriptionLabel')}
            as="textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {/* Max members input removed for unlimited members */}

          <Checkbox
            label={t('groupForm.publicGroupLabel')}
            id="isPublic"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />

          <Button type="submit" className="create-group-submit-btn">
            {t('groupForm.createButton')}
          </Button>
        </form>
        {error && <p className="error-message">{error}</p>}

        <div className="join-group-cta">
          <p>{t('groupForm.joinGroupCta')}</p>
          <Link to="/join-group" className="join-group-link">{t('groupForm.joinGroupLink')}</Link>
        </div>

        <Link to="/dashboard" className="back-link">
          {t('groupOptions.backToDashboard')}
        </Link>
      </div>
    </div>
  );
}
