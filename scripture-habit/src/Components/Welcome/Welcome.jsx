import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../Button/Button';
import Mascot from '../Mascot/Mascot';
import { useLanguage } from '../../Context/LanguageContext';
import './Welcome.css';

const Welcome = () => {
    const { t, setLanguage, language } = useLanguage();

    return (
        <div className="AppGlass welcome-container">
            <h1>{t('welcome.title')}</h1>

            <Mascot customMessage={t('mascot.welcomeMessage')} />

            <div className="language-selection">
                <p className="language-instruction">
                    {t('welcome.chooseLanguage')}
                </p>
                <div className="language-buttons">
                    <button
                        className={`lang-btn ${language === 'en' ? 'active' : ''}`}
                        onClick={() => setLanguage('en')}
                    >
                        English
                    </button>
                    <button
                        className={`lang-btn ${language === 'ja' ? 'active' : ''}`}
                        onClick={() => setLanguage('ja')}
                    >
                        日本語
                    </button>
                    <button
                        className={`lang-btn ${language === 'pt' ? 'active' : ''}`}
                        onClick={() => setLanguage('pt')}
                    >
                        Português
                    </button>
                    <button
                        className={`lang-btn ${language === 'zho' ? 'active' : ''}`}
                        onClick={() => setLanguage('zho')}
                    >
                        繁體中文
                    </button>
                    <button
                        className={`lang-btn ${language === 'es' ? 'active' : ''}`}
                        onClick={() => setLanguage('es')}
                    >
                        Español
                    </button>
                    <button
                        className={`lang-btn ${language === 'vi' ? 'active' : ''}`}
                        onClick={() => setLanguage('vi')}
                    >
                        Tiếng Việt
                    </button>
                    <button
                        className={`lang-btn ${language === 'th' ? 'active' : ''}`}
                        onClick={() => setLanguage('th')}
                    >
                        ไทย
                    </button>
                    <button
                        className={`lang-btn ${language === 'ko' ? 'active' : ''}`}
                        onClick={() => setLanguage('ko')}
                    >
                        한국어
                    </button>
                    <button
                        className={`lang-btn ${language === 'tl' ? 'active' : ''}`}
                        onClick={() => setLanguage('tl')}
                    >
                        Tagalog
                    </button>
                    <button
                        className={`lang-btn ${language === 'sw' ? 'active' : ''}`}
                        onClick={() => setLanguage('sw')}
                    >
                        Swahili
                    </button>
                </div>
            </div>

            <div className="auth-buttons">
                <Link to="/login">
                    <Button className="login-btn">{t('welcome.login')}</Button>
                </Link>
                <Link to="/signup">
                    <Button className="signup-btn">{t('welcome.signup')}</Button>
                </Link>
            </div>
        </div>
    );
};

export default Welcome;
