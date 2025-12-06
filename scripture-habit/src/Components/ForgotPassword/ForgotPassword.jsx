import { useState } from "react";
import "./ForgotPassword.css";
import Button from "../Button/Button";
import Input from "../Input/Input";
import { auth } from "../../firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { Link } from "react-router-dom";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleReset = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset link has been sent to your email.");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="App ForgotPassword">
      <div className="AppGlass">
        <h2>Reset Your Password</h2>

        <form onSubmit={handleReset}>
          <Input
            label="Enter your email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Button type="submit">Send Reset Link</Button>
        </form>

        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}

        <div className="auth-switch">
          <Link to="/login" className="auth-link">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
