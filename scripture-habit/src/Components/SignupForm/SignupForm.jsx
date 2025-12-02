import { useState } from 'react';
import Button from '../Button/Button';
import { auth, db } from '../../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import Input from '../Input/Input';
import './SignupForm.css'

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
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
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
        setError("Failed to save user profile. Please contact support.");
        return; 
      }

      navigate('/group-options');

    } catch (authError) {
      console.error("Error creating user in Authentication:", authError);
      if (authError.code === 'auth/email-already-in-use') {
        setError("This email address is already in use. Please log in or use a different email.");
      } else {
        setError(authError.message);
      }
    }
  };

  return (
    <div className="App SignupForm">
      <div className='AppGlass Form'>
        <h2>Sign Up</h2>
        <form onSubmit={handleSubmit}>
          <Input
            label="Nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
          />
          <Input
            label="Gmail Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit">
            Sign Up
          </Button>
        </form>
        {error && <p style={{ color: 'red', marginTop: 10 }}>{error}</p>}

        <div className="auth-switch">
          <p>Already have an account? <Link to="/login" className="auth-link">Log In</Link></p>
        </div>
      </div>
    </div>

  );
}
