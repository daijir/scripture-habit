import { useState } from "react";
import "./ForgotPassword.css";
import Button from "../Button/Button";
import Input from "../Input/Input";
import { auth } from "../../firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { Link } from "react-router-dom";
import { useLanguage } from "../../Context/LanguageContext";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const { t } = useLanguage();

  const handleReset = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage(t('forgotPasswordPage.successMessage'));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="App ForgotPassword">
      <div className="AppGlass">
        <h2>{t('forgotPasswordPage.title')}</h2>

        <form onSubmit={handleReset}>
          <Input
            label={t('forgotPasswordPage.emailLabel')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Button type="submit">{t('forgotPasswordPage.submitButton')}</Button>
        </form>

        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}

        <div className="auth-switch">
          <Link to="/login" className="auth-link">{t('forgotPasswordPage.backToLogin')}</Link>
        </div>
      </div>
    </div>
  );
}
