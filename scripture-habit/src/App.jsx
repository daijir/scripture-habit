import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useEffect, useState } from 'react';
import { Analytics } from "@vercel/analytics/react";
import { db, auth } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

import SignupForm from './Components/SignupForm/SignupForm';
import LoginForm from './Components/LoginForm/LoginForm';
import Button from './Components/Button/Button';
import Dashboard from './Components/Dashboard/Dashboard';
import GroupForm from './Components/GroupForm/GroupForm';
import JoinGroup from './Components/JoinGroup/JoinGroup';
import GroupDetails from "./Components/GroupDetails/GroupDetails";
import GroupOptions from './Components/GroupOptions/GroupOptions';
import LandingPage from './Components/LandingPage/LandingPage';
import Welcome from './Components/Welcome/Welcome';
import { LanguageProvider, useLanguage } from './Context/LanguageContext.jsx';
import ForgotPassword from "./Components/ForgotPassword/ForgotPassword";
import InviteRedirect from './Components/InviteRedirect/InviteRedirect';
import Maintenance from './Components/Maintenance/Maintenance';
import { MAINTENANCE_MODE } from './config';
import * as Sentry from "@sentry/react";
import InstallPrompt from './Components/InstallPrompt/InstallPrompt';
import { handleInAppBrowserRedirect, isInAppBrowser } from './Utils/browserDetection';
import CookieConsent from './Components/CookieConsent/CookieConsent';
import BrowserWarningModal from './Components/BrowserWarningModal/BrowserWarningModal';

import PrivacyPolicy from './Components/PrivacyPolicy/PrivacyPolicy';
import TermsOfService from './Components/TermsOfService/TermsOfService';
import LegalDisclosure from './Components/LegalDisclosure/LegalDisclosure';

const SEOManager = () => {
  const { t, language } = useLanguage();

  useEffect(() => {
    // Update Document Title
    document.title = t('seo.title') || "Scripture Habit";

    // Update Meta Description
    const description = t('seo.description');
    if (description) {
      document.querySelector('meta[name="description"]')?.setAttribute('content', description);
      document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
      document.querySelector('meta[property="twitter:description"]')?.setAttribute('content', description);
    }

    // Update OG/Twitter Titles
    const title = t('seo.title');
    if (title) {
      document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
      document.querySelector('meta[property="twitter:title"]')?.setAttribute('content', title);
    }

    // Update HTML lang attribute
    document.documentElement.lang = language || 'en';
  }, [language, t]);

  return null;
};

const App = () => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showBrowserWarning, setShowBrowserWarning] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const isRedirecting = handleInAppBrowserRedirect();
    if (!isRedirecting && isInAppBrowser()) {
      setShowBrowserWarning(true);
    }
  }, []);

  const [systemStatus, setSystemStatus] = useEffectSpecialState(() => {
    // Probe Firestore for status/quota
    const statusRef = doc(db, 'system', 'status');
    const unsubscribe = onSnapshot(statusRef, (docSnap) => {
      if (docSnap.exists()) {
        setSystemStatus({ ...docSnap.data(), loading: false, error: null });
      } else {
        setSystemStatus({ loading: false, error: null });
      }
    }, (err) => {
      console.error("System probe failed:", err);
      const isQuota = err.code === 'resource-exhausted' || err.message.toLowerCase().includes('quota exceeded');

      // Log legitimate errors to Sentry, but ignore expected quota issues
      if (!isQuota) {
        Sentry.captureException(err);
      }

      setSystemStatus({ loading: false, error: isQuota ? 'quota' : err.message });
    });
    return unsubscribe;
  });

  // Helper because we need actual state here
  function useEffectSpecialState(effect) {
    const [state, setState] = useState({ loading: true, error: null });
    useEffect(() => {
      return effect();
    }, []);
    return [state, setState];
  }

  if (MAINTENANCE_MODE || systemStatus.error === 'quota' || systemStatus.maintenance) {
    return (
      <LanguageProvider>
        <SEOManager />
        <Maintenance isQuota={systemStatus.error === 'quota'} />
      </LanguageProvider>
    );
  }

  const location = useLocation();
  const getAppClass = () => {
    const path = location.pathname;
    if (path === '/') return 'App LandingPage';
    if (path === '/welcome') return 'App Welcome';
    if (path === '/login') return 'App LoginForm';
    if (path === '/signup') return 'App SignupForm';
    if (path === '/dashboard') return 'App Dashboard';
    return 'App';
  };

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  if (authLoading) return null; // Or a loading spinner

  return (
    <LanguageProvider>
      <SEOManager />
      <div className={getAppClass()}>
        <Routes>
          <Route
            path="/"
            element={isStandalone ? <Navigate to="/dashboard" replace /> : <LandingPage />}
          />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/login" element={<LoginForm />} />
          <Route path="/signup" element={<SignupForm />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/group-form" element={<GroupForm />} />
          <Route path="/join-group" element={<JoinGroup />} />

          <Route path="/group-options" element={<GroupOptions />} />
          <Route path="/group/:id" element={<GroupDetails />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/join/:inviteCode" element={<InviteRedirect />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/legal" element={<LegalDisclosure />} />

        </Routes>
        <ToastContainer position="top-right" autoClose={3000} />
        <Analytics />
        <InstallPrompt />
        <CookieConsent />
        <BrowserWarningWrapper
          isOpen={showBrowserWarning}
          onClose={() => setShowBrowserWarning(false)}
        />
      </div>
    </LanguageProvider>
  );
};

const BrowserWarningWrapper = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  return (
    <BrowserWarningModal
      isOpen={isOpen}
      onClose={onClose}
      onContinue={onClose}
      t={t}
    />
  );
};

export default Sentry.withErrorBoundary(App, {
  fallback: ({ error, resetError }) => (
    <div className="App" style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      textAlign: 'center',
      background: 'linear-gradient(135deg, #f6f8fb 0%, #e9edf5 100%)'
    }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🙏</div>
      <h1 style={{ color: '#2d3748', marginBottom: '1rem' }}>Something went wrong</h1>
      <p style={{ color: '#4a5568', marginBottom: '2rem', maxWidth: '500px' }}>
        We apologize for the inconvenience. A report has been sent to our team, and we are working to fix this.
      </p>
      <button
        onClick={() => {
          resetError();
          window.location.href = '/dashboard';
        }}
        style={{
          padding: '0.8rem 2rem',
          background: 'linear-gradient(135deg, #FF919D 0%, #4a90e2 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(107, 70, 193, 0.2)'
        }}
      >
        Reload Application
      </button>
      {process.env.NODE_ENV === 'development' && (
        <pre style={{
          marginTop: '2rem',
          textAlign: 'left',
          fontSize: '0.8rem',
          background: '#fff',
          padding: '1rem',
          borderRadius: '8px',
          maxWidth: '90%',
          overflow: 'auto',
          border: '1px solid #e2e8f0'
        }}>
          {error.toString()}
        </pre>
      )}
    </div>
  ),
});
