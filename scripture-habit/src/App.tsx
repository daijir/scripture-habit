import React, { Component, ErrorInfo } from 'react'
import './App.css'
import GroupCreate from './groups/GroupCreate'
import GroupList from './groups/GroupList'
import useAuth from './hooks/useAuth'
import { auth, analytics as firebaseAnalytics } from './firebase'
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error | null }>{
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, error: err };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Uncaught error in App:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20 }}>
          <h2>Something went wrong</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children as any;
  }
}

function Diagnostics() {
  const user = useAuth();
  const env = {
    VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY ?? null,
    VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? null,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? null,
    VITE_FIREBASE_MEASUREMENT_ID: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? null,
  } as Record<string, string | null>;

  return (
    <div style={{ padding: 12, border: '1px dashed #666', marginBottom: 12 }}>
      <strong>Diagnostics</strong>
      <div>Firebase analytics initialized: {firebaseAnalytics ? 'yes' : 'no'}</div>
      <div>Auth ready: {auth ? 'yes' : 'no'}</div>
      <div>Signed in: {user ? 'yes' : 'no'}</div>
      <details style={{ marginTop: 8 }}>
        <summary>Env preview (masked)</summary>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(env, null, 2)}</pre>
      </details>
    </div>
  );
}

function App() {
  const user = useAuth();

  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Sign in failed', err);
      alert('Sign in failed');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out failed', err);
      alert('Sign out failed');
    }
  };

  return (
    <ErrorBoundary>
      <div style={{ padding: 20 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Scripture Habit — Groups</h2>
          <div>
            {user ? (
              <>
                <span style={{ marginRight: 8 }}>Hi, {user.displayName ?? user.email}</span>
                <button onClick={handleSignOut}>Sign out</button>
              </>
            ) : (
              <button onClick={handleSignIn}>Sign in with Google</button>
            )}
          </div>
        </header>

        <Diagnostics />

        <main style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 16 }}>
          <div>
            <GroupCreate currentUser={user ? { uid: user.uid, displayName: user.displayName ?? undefined } : null} />
          </div>
          <div>
            <GroupList currentUser={user ? { uid: user.uid } : null} />
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App
