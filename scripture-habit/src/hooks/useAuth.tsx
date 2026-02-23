import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

export default function useAuth() {
  const firebaseAuth = auth;
  const [user, setUser] = useState<User | null>(firebaseAuth?.currentUser || null);

  useEffect(() => {
    if (!firebaseAuth) return;
    const unsub = onAuthStateChanged(firebaseAuth, (u) => setUser(u));
    return () => unsub();
  }, [firebaseAuth]);

  return user;
}
