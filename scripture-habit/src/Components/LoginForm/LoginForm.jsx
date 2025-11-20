import { useState } from 'react';
import './LoginForm.css';
import Button from '../Button/Button';
import Input from '../Input/Input';
import { auth, db } from '../../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function LoginForm() {
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
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      try {
        await updateDoc(doc(db, 'users', user.uid), {
          lastActiveAt: new Date()
        });
      } catch (updateError) {
        console.error("Error updating last active time:", updateError);
      }

      navigate('/dashboard');
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className='App LoginForm'>
      <div className='AppGlass'>
        <h2>Log In</h2>
        <form onSubmit={handleSubmit}>
          <Input
            label="Gmail Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit">
            Log In
          </Button>
        </form>
        {error && <p className='error'>{error}</p>}
      </div>
    </div>

  );
}
