import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../Context/LanguageContext';
import './Footer.css';

const Footer = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();

    return (
        <footer className="app-footer">
            <div className="footer-content">
                <div className="footer-links">
                    <span className="footer-link" onClick={() => navigate('/privacy')}>
                        {t('privacy.title')}
                    </span>
                    <span className="footer-separator">•</span>
                    <span className="footer-link" onClick={() => navigate('/terms')}>
                        {t('terms.title')}
                    </span>
                    <span className="footer-separator">•</span>
                </div>
                <div className="footer-copyright">
                    © {new Date().getFullYear()} Scripture Habit
                </div>
            </div>
        </footer>
    );
};

export default Footer;
