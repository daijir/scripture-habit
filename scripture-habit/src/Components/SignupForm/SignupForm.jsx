import { useState } from 'react';
import Button from '../Button/Button';
import { auth, db } from '../../firebase';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import Input from '../Input/Input';
import './SignupForm.css'
import { useLanguage } from '../../Context/LanguageContext';
import { UilGoogle } from '@iconscout/react-unicons';

export default function SignupForm() {
  const { t } = useLanguage();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);
  const navigate = useNavigate();

  const handleGoogleSignup = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user doc exists
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        // User needs to set nickname
        setPendingGoogleUser(user);
        setNickname(user.displayName || '');
      } else {
        // User exists, just redirect
        navigate('/group-options');
      }

    } catch (error) {
      console.error("Error signing in with Google:", error);
      setError(error.message);
    }
  };

  const handleCompleteGoogleSignup = async (e) => {
    e.preventDefault();
    if (!pendingGoogleUser) return;

    try {
      const now = new Date();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const userData = {
        createdAt: now,
        email: pendingGoogleUser.email,
        groupId: "",
        joinedAt: now,
        lastPostDate: "",
        nickname: nickname || 'New User',
        preferredCheckInTime: "00:00",
        streakCount: 0,
        totalNotes: 0,
        timeZone: timeZone,
      };

      await setDoc(doc(db, 'users', pendingGoogleUser.uid), userData);
      navigate('/group-options');

    } catch (firestoreError) {
      console.error("Error writing user data to Firestore:", firestoreError);
      setError(t('signup.errorSaveProfile'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email.endsWith('@gmail.com')) {
      setError(t('signup.errorGmail'));
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Send verification email
      await sendEmailVerification(user);
      window.alert(t('signup.verificationSent'));

      const now = new Date();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const userData = {
        createdAt: now,
        email: user.email,
        groupId: "",
        joinedAt: now,
        lastPostDate: "",
        nickname: nickname,
        preferredCheckInTime: "00:00",
        streakCount: 0,
        totalNotes: 0,
        timeZone: timeZone,
      };

      try {
        await setDoc(doc(db, 'users', user.uid), userData);
      } catch (firestoreError) {
        console.error("Error writing user data to Firestore:", firestoreError);
        setError(t('signup.errorSaveProfile'));
        return;
      }

      navigate('/group-options');

    } catch (authError) {
      console.error("Error creating user in Authentication:", authError);
      if (authError.code === 'auth/email-already-in-use') {
        setError(t('signup.errorEmailInUse'));
      } else {
        setError(authError.message);
      }
    }
  };

  if (pendingGoogleUser) {
    return (
      <div className="App SignupForm">
        <div className='AppGlass Form'>
          <h2>{t('signup.completeProfile')}</h2>
          <form onSubmit={handleCompleteGoogleSignup}>
            <Input
              label={t('signup.nicknameLabel')}
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
            />
            <Button type="submit">
              {t('signup.finishSignup')}
            </Button>
          </form>
          {error && <p style={{ color: 'red', marginTop: 10 }}>{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="App SignupForm">
      <div className='AppGlass Form'>
        <h2>{t('signup.title')}</h2>

        <button
          onClick={handleGoogleSignup}
          className="google-btn"
          type="button"
        >
          <UilGoogle size="20" />
          {t('signup.googleButton')}
        </button>

        <div className="separator">
          <span>OR</span>
        </div>

        <form onSubmit={handleSubmit}>
          <Input
            label={t('signup.nicknameLabel')}
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
          />
          <Input
            label={t('signup.emailLabel')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required />
          <Input
            label={t('signup.passwordLabel')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit">
            {t('signup.submitButton')}
          </Button>
        </form>
        {error && <p style={{ color: 'red', marginTop: 10 }}>{error}</p>}

        <div className="auth-switch">
          <p>{t('signup.hasAccount')} <Link to="/login" className="auth-link">{t('signup.loginLink')}</Link></p>
        </div>
      </div>
    </div>
  );
}
