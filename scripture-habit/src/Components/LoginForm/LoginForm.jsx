import { useState } from 'react';
import './LoginForm.css';
import Button from '../Button/Button';
import Input from '../Input/Input';
import { auth, db } from '../../firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../../Context/LanguageContext';
import { UilGoogle } from '@iconscout/react-unicons';

export default function LoginForm() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState(null);
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user doc exists
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        // User needs to set nickname (Treat as signup)
        setPendingGoogleUser(user);
        setNickname(user.displayName || '');
      } else {
        navigate('/dashboard');
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
      setError(t('login.errorGmail'));
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/dashboard');
    } catch (error) {
      setError(error.message);
    }
  };

  if (pendingGoogleUser) {
    return (
      <div className='App LoginForm'>
        <div className='AppGlass'>
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
    <div className='App LoginForm'>
      <div className='AppGlass'>
        <h2>{t('login.title')}</h2>

        <button
          onClick={handleGoogleLogin}
          className="google-btn"
          type="button"
        >
          <UilGoogle size="20" />
          {t('login.googleButton')}
        </button>

        <div className="separator">
          <span>OR</span>
        </div>

        <form onSubmit={handleSubmit}>
          <Input
            label={t('login.emailLabel')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label={t('login.passwordLabel')}
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div className="forgot-password-container">
            <Link to="/forgot-password" className="forgot-password-link">
              {t('login.forgotPassword')}
            </Link>
          </div>

          <Button type="submit">
            {t('login.submitButton')}
          </Button>
        </form>

        {/* Error message */}
        {error && <p className='error'>{error}</p>}

        {/* Switch to Sign Up */}
        <div className="auth-switch">
          <p>{t('login.noAccount')} <Link to="/signup" className="auth-link">{t('login.signupLink')}</Link></p>
        </div>
      </div>
    </div>
  );
}
