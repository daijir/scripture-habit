import { useState } from 'react';
import './LoginForm.css';
import Button from '../Button/Button';
import Input from '../Input/Input';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!email.endsWith('@gmail.com')) {
      setError('Please use a Gmail address.');
      return;
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
