import { useState, type FormEvent } from 'react';

export default function SignupForm() {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.endsWith('@gmail.com')) {
      setError('Please use a Gmail address.');
      return;
    }

    alert(`Signup successful!\nNickname: ${nickname}\nEmail: ${email}`);
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
        <button type="submit" style={{ padding: 8 }}>
          Sign Up
        </button>
      </form>
      {error && <p style={{ color: 'red', marginTop: 10 }}>{error}</p>}
    </div>
  );
}
