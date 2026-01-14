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
import { LanguageProvider, useLanguage, SUPPORTED_LANGUAGES } from './Context/LanguageContext.jsx';
import { SettingsProvider } from './Context/SettingsContext.jsx';

const SEOManager = () => {
  const { t, language } = useLanguage();
  const location = useLocation();

  useEffect(() => {
    // Update Document Title
    const title = t('seo.title') || "Scripture Habit";
    document.title = title;

    // Update Meta Description
    const description = t('seo.description');
    if (description) {
      document.querySelector('meta[name="description"]')?.setAttribute('content', description);
      document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
      document.querySelector('meta[property="twitter:description"]')?.setAttribute('content', description);
    }

    // Update OG/Twitter Titles
    if (title) {
      document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
      document.querySelector('meta[property="twitter:title"]')?.setAttribute('content', title);
    }

    // Update Canonical Tag
    // Enforce trailing slash and language prefix
    let path = location.pathname;

    // Extract base path (without language prefix if present)
    const pathParts = path.split('/');
    const currentPrefix = pathParts[1];
    const baseContentPath = SUPPORTED_LANGUAGES.includes(currentPrefix)
      ? '/' + pathParts.slice(2).join('/')
      : path;

    // Canonical URL for the CURRENT language
    let canonicalPath = `/${language}${baseContentPath === '/' ? '' : baseContentPath}`;
    if (canonicalPath !== '/' && !canonicalPath.endsWith('/')) {
      canonicalPath += '/';
    }
    const canonicalUrl = `https://scripturehabit.app${canonicalPath}`;

    let canonicalTag = document.querySelector('link[rel="canonical"]');
    if (canonicalTag) {
      canonicalTag.setAttribute('href', canonicalUrl);
    } else {
      canonicalTag = document.createElement('link');
      canonicalTag.setAttribute('rel', 'canonical');
      canonicalTag.setAttribute('href', canonicalUrl);
      document.head.appendChild(canonicalTag);
    }

    // Update OG URL
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonicalUrl);
    document.querySelector('meta[property="twitter:url"]')?.setAttribute('content', canonicalUrl);

    // Update HTML lang attribute
    const langMap = {
      'zho': 'zh-Hant',
    };
    const currentLang = langMap[language] || language || 'en';
    document.documentElement.lang = currentLang;

    // Update OG Locale
    const localeMap = {
      'en': 'en_US', 'ja': 'ja_JP', 'pt': 'pt_BR', 'zho': 'zh_TW',
      'es': 'es_ES', 'vi': 'vi_VN', 'th': 'th_TH', 'ko': 'ko_KR',
      'tl': 'tl_PH', 'sw': 'sw_KE'
    };
    document.querySelector('meta[property="og:locale"]')?.setAttribute('content', localeMap[language] || 'en_US');

    // Manage Hreflang tags - pointing to each language version of the SAME content
    SUPPORTED_LANGUAGES.forEach(lang => {
      const hLang = lang === 'zho' ? 'zh-Hant' : lang;
      let link = document.querySelector(`link[hreflang="${hLang}"]`);
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'alternate');
        link.setAttribute('hreflang', hLang);
        document.head.appendChild(link);
      }

      let langSpecificPath = `/${lang}${baseContentPath === '/' ? '' : baseContentPath}`;
      if (langSpecificPath !== '/' && !langSpecificPath.endsWith('/')) {
        langSpecificPath += '/';
      }
      link.setAttribute('href', `https://scripturehabit.app${langSpecificPath}`);
    });

    // x-default hreflang (usually English or a generic path)
    let xDefault = document.querySelector('link[hreflang="x-default"]');
    if (!xDefault) {
      xDefault = document.createElement('link');
      xDefault.setAttribute('rel', 'alternate');
      xDefault.setAttribute('hreflang', 'x-default');
      document.head.appendChild(xDefault);
    }

    // Point x-default to the English version
    let xDefaultPath = `/en${baseContentPath === '/' ? '' : baseContentPath}`;
    if (xDefaultPath !== '/' && !xDefaultPath.endsWith('/')) {
      xDefaultPath += '/';
    }
    xDefault.setAttribute('href', `https://scripturehabit.app${xDefaultPath}`);
  }, [language, t, location.pathname]);

  return null;
};

const PWAUpdateHandler = () => {
  const { t } = useLanguage();

  useEffect(() => {
    const handleUpdateAvailable = (event) => {
      const registration = event.detail;
      const updateMessage = t('installPrompt.updateAvailable');
      const updateButtonText = t('installPrompt.updateButton');

      import('react-toastify').then(({ toast }) => {
        toast.info(
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '10px' }}>
            <span style={{ fontSize: '0.9rem' }}>{updateMessage}</span>
            <button
              onClick={() => {
                console.log('Update button clicked. Registration:', registration);

                // Track if we successfully sent a signal
                let signaling = false;

                if (registration) {
                  const worker = registration.waiting || registration.installing;
                  if (worker) {
                    worker.postMessage({ type: 'SKIP_WAITING' });
                    signaling = true;
                  }
                }

                // If no worker found or signaling failed, or as a safety measure,
                // give it a short moment to activate and then force reload
                setTimeout(() => {
                  window.location.reload();
                }, 500);
              }}
              style={{
                padding: '6px 12px',
                background: '#4a90e2',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                whiteSpace: 'nowrap'
              }}
            >
              {updateButtonText}
            </button>
          </div>,
          {
            toastId: 'pwa-update',
            position: "bottom-center",
            autoClose: false,
            closeOnClick: false,
            draggable: false,
            closeButton: false,
            style: {
              background: '#fff',
              color: '#1a202c',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              borderRadius: '12px',
              padding: '12px'
            }
          }
        );
      });
    };

    window.addEventListener('pwa-update-available', handleUpdateAvailable);
    return () => window.removeEventListener('pwa-update-available', handleUpdateAvailable);
  }, [t]);

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
      <SettingsProvider>
        <LanguageProvider>
          <SEOManager />
          <Maintenance isQuota={systemStatus.error === 'quota'} />
        </LanguageProvider>
      </SettingsProvider>
    );
  }

  const location = useLocation();
  const getAppClass = () => {
    const path = location.pathname;
    const pathParts = path.split('/');
    const firstPart = pathParts[1];

    // Determine the base path regardless of language prefix
    let base = path;
    if (SUPPORTED_LANGUAGES.includes(firstPart)) {
      base = '/' + pathParts.slice(2).join('/');
    }

    // Normalize to handle trailing slashes
    if (base !== '/' && base.endsWith('/')) {
      base = base.slice(0, -1);
    }

    if (base === '' || base === '/') return 'App LandingPage';
    if (base === '/welcome') return 'App Welcome';
    if (base === '/login') return 'App LoginForm';
    if (base === '/signup') return 'App SignupForm';
    if (base === '/dashboard') return 'App Dashboard';
    return 'App';
  };

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  const renderContent = () => {
    if (authLoading) {
      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #FF919D 0%, #FFD1FF 100%)',
          color: 'white',
          fontFamily: "'Outfit', sans-serif"
        }}>
          <div className="loading-spinner-container" style={{
            width: '60px',
            height: '60px',
            border: '6px solid rgba(255,255,255,0.3)',
            borderTop: '6px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '1rem'
          }}></div>
          <style>{`
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          `}</style>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '600', animation: 'fadeIn 0.5s ease-in' }}>
            Scripture Habit
          </h2>
        </div>
      );
    }

    return (
      <div className={getAppClass()}>
        <Routes>
          {SUPPORTED_LANGUAGES.map(lang => (
            <Route key={lang} path={lang}>
              <Route
                index
                element={isStandalone ? <Navigate to="dashboard" replace /> : <LandingPage />}
              />
              <Route path="welcome" element={<Welcome />} />
              <Route path="login" element={<LoginForm />} />
              <Route path="signup" element={<SignupForm />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="group-form" element={<GroupForm />} />
              <Route path="join-group" element={<JoinGroup />} />

              <Route path="group-options" element={<GroupOptions />} />
              <Route path="group/:id" element={<GroupDetails />} />
              <Route path="forgot-password" element={<ForgotPassword />} />
              <Route path="join/:inviteCode" element={<InviteRedirect />} />
              <Route path="privacy" element={<PrivacyPolicy />} />
              <Route path="terms" element={<TermsOfService />} />
              <Route path="legal" element={<LegalDisclosure />} />
              {/* Catch-all for invalid paths within a language prefix */}
              <Route path="*" element={<Navigate to="" replace />} />
            </Route>
          ))}
          {/* Support root path and any prefix-less path by redirecting to detected lang */}
          <Route path="*" element={<LanguageRedirect location={location} />} />
        </Routes>
      </div>
    );
  };

  return (
    <SettingsProvider>
      <LanguageProvider>
        <SEOManager />
        <PWAUpdateHandler />
        {renderContent()}
        <ToastContainer position="top-right" autoClose={3000} />
        <Analytics />
        <InstallPrompt />
        <CookieConsent />
        <BrowserWarningWrapper
          isOpen={showBrowserWarning}
          onClose={() => setShowBrowserWarning(false)}
        />
      </LanguageProvider>
    </SettingsProvider>
  );
};

const LanguageRedirect = ({ location }) => {
  const { language } = useLanguage();
  const path = location.pathname;
  const pathParts = path.split('/');
  const firstPart = pathParts[1];

  // If already prefixed with a supported language, don't redirect (let Routes handle it)
  if (SUPPORTED_LANGUAGES.includes(firstPart)) {
    return null;
  }

  // Otherwise, prefix with current detected language
  const newPath = `/${language}${path === '/' ? '' : path}`;
  return <Navigate to={newPath} replace />;
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
