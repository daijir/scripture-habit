import { useState } from 'react';
import Button from '../Button/Button';
import { auth, db } from '../../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function SignupForm() {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email.endsWith('@gmail.com')) {
      setError('Please use a Gmail address.');
      return;
    }

    try {
      // 1. Create user in Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const now = new Date();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // 2. Prepare user data document according to the desired schema
      const userData = {
        createdAt: now,
        email: user.email,
        groupId: "",
        joinedAt: now,
        lastActiveAt: now,
        lastPostDate: "", // Initially empty, updated on first post
        nickname: nickname,
        preferredCheckInTime: "00:00",
        streakCount: 0, // Start at 0
        timeZone: timeZone,
      };

      // 3. Save user data to Firestore with specific error handling
      try {
        await setDoc(doc(db, 'users', user.uid), userData);
      } catch (firestoreError) {
        console.error("Error writing user data to Firestore:", firestoreError);
        setError("Failed to save user profile. Please contact support.");
        // Optional: You might want to delete the created user if saving fails
        // await user.delete();
        return; // Stop execution if Firestore write fails
      }

      // 4. Redirect to dashboard
      navigate('/dashboard');

    } catch (authError) {
      // Handle Authentication errors
      console.error("Error creating user in Authentication:", authError);
      if (authError.code === 'auth/email-already-in-use') {
        setError("This email address is already in use. Please log in or use a different email.");
      } else {
        setError(authError.message);
      }
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: 20 }}>
      <h2>Sign Up</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 10 }}>
          <label>Nickname</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            style={{ width: '100%', padding: 6 }}
          />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label>Gmail Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: 6 }}
          />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: 6 }}
          />
        </div>
        <Button type="submit">
          Sign Up
        </Button>
      </form>
      {error && <p style={{ color: 'red', marginTop: 10 }}>{error}</p>}
    </div>
  );
}
