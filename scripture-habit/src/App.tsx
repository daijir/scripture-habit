import React from 'react'
import './App.css'
import GroupCreate from './groups/GroupCreate'
import GroupList from './groups/GroupList'
import useAuth from './hooks/useAuth'
import { auth } from './firebase'
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'

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

      <main style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 16 }}>
        <div>
          <GroupCreate currentUser={user ? { uid: user.uid, displayName: user.displayName ?? undefined } : null} />
        </div>
        <div>
          <GroupList currentUser={user ? { uid: user.uid } : null} />
        </div>
      </main>
    </div>
  )
}

export default App
