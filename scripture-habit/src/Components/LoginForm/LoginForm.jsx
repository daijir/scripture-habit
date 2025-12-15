import { useState } from 'react';
import './LoginForm.css';
import Button from '../Button/Button';
import Input from '../Input/Input';
import { auth, db } from '../../firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, signOut, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../../Context/LanguageContext';
import { UilGoogle, UilGithub } from '@iconscout/react-unicons';

export default function LoginForm() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState(null);
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);
  const [unverifiedUser, setUnverifiedUser] = useState(null);
  const navigate = useNavigate();

  const isInApp = () => {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    return /(Line|Instagram|FBAN|FBAV|Daum|Kakao|Snapchat)/i.test(ua);
  };

  const showInAppWarning = isInApp();

  const handleSocialLogin = async (provider) => {
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
      console.error("Error signing in with provider:", error);
      if (error.code === 'auth/account-exists-with-different-credential') {
        setError(t('signup.errorAccountExistsWithDifferentCredential'));
      } else {
        setError(error.message);
      }
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
    setUnverifiedUser(null);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      if (!userCredential.user.emailVerified) {
        setUnverifiedUser(userCredential.user);
        setError(t('login.emailNotVerified'));
        return;
      }

      navigate('/dashboard');
    } catch (error) {
      setError(error.message);
    }
  };

  const handleResendVerification = async () => {
    if (unverifiedUser) {
      try {
        await sendEmailVerification(unverifiedUser);
        window.alert(t('login.verificationResent'));
      } catch (error) {
        console.error("Error resending verification email:", error);
        setError("Error: " + error.message);
      }
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

        {showInAppWarning && (
          <div style={{
            backgroundColor: '#fff3cd',
            color: '#856404',
            padding: '10px',
            borderRadius: '5px',
            marginBottom: '15px',
            fontSize: '0.9rem',
            lineHeight: '1.4'
          }}>
            {t('login.inAppBrowserWarning')}
          </div>
        )}

        <button
          onClick={() => handleSocialLogin(new GoogleAuthProvider())}
          className="google-btn"
          type="button"
        >
          <UilGoogle size="20" />
          {t('login.googleButton')}
        </button>

        <button
          onClick={() => handleSocialLogin(new GithubAuthProvider())}
          className="github-btn"
          type="button"
        >
          <UilGithub size="20" />
          {t('login.githubButton')}
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
        {error && (
          <div className='error-container' style={{ marginTop: '10px' }}>
            <p className='error'>{error}</p>
            {unverifiedUser && (
              <button
                type="button"
                onClick={handleResendVerification}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4a90e2',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  marginTop: '5px',
                  fontSize: '0.9rem'
                }}
              >
                {t('login.resendVerification')}
              </button>
            )}
          </div>
        )}

        {/* Switch to Sign Up */}
        <div className="auth-switch">
          <p>{t('login.noAccount')} <Link to="/signup" className="auth-link">{t('login.signupLink')}</Link></p>
        </div>
      </div>
    </div>
  );
}
