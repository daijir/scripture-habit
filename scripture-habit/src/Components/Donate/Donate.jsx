import React from 'react';
import './Donate.css';
import { useLanguage } from '../../Context/LanguageContext';
import Mascot from '../Mascot/Mascot';
import Footer from '../Footer/Footer';

const Donate = ({ userData }) => {
    const { t } = useLanguage();
    const [showQR, setShowQR] = React.useState(false);
    const [showBackgroundModal, setShowBackgroundModal] = React.useState(false);

    return (
        <div className="Donate DashboardContent">
            <div className="dashboard-header">
                <h1>{t('donate.title')}</h1>
                <div className="donate-mascot-wrapper">
                    <Mascot
                        userData={userData}
                        customMessage={t('donate.description')}
                    />
                </div>
            </div>
            <div className="donate-container">
                <div className="donate-card">
                    <p className="donate-vision-statement">
                        {t('donate.vision')}
                    </p>

                    <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                        <button
                            className="donate-action-btn"
                            onClick={() => setShowBackgroundModal(true)}
                            style={{
                                background: 'var(--pink)',
                                border: 'none',
                                padding: '1rem 2rem',
                                fontSize: '1.1rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                color: '#fff',
                                borderRadius: '12px',
                                boxShadow: '0 4px 12px rgba(255, 105, 180, 0.3)'
                            }}
                        >
                            📖 {t('donate.appBackground')}
                        </button>
                    </div>

                    <p className="donate-subheader">
                        {t('donate.subHeader')}
                    </p>

                    <div className="donate-suggestions">
                        <h3>{t('donate.suggestionTitle')}</h3>
                        <ul className="donate-suggestions-list">
                            <li>{t('donate.suggestion1')}</li>
                            <li>{t('donate.suggestion2')}</li>
                            <li>{t('donate.suggestion3')}</li>
                        </ul>
                    </div>

                    <p className="donate-methods-header">
                        {t('donate.methodsHeader')}
                    </p>

                    <div className="donate-section">
                        <div className="donate-buttons-container">
                            <div className="donate-btn-wrapper">
                                <button
                                    className="donate-action-btn paypay-btn"
                                    onClick={() => setShowQR(!showQR)}
                                >
                                    {t('donate.payPayButton')}
                                </button>
                                {showQR && (
                                    <div className="qr-code-container fade-in">
                                        <img src="/images/donation-qr-code.png" alt="PayPay QR Code" className="paypay-qr-code" />
                                    </div>
                                )}
                            </div>

                            <div className="donate-btn-wrapper">
                                <button
                                    className="donate-action-btn paypal-btn"
                                    onClick={() => window.open('https://paypal.me/daijiro645', '_blank')}
                                >
                                    {t('donate.button')}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="donate-separator"></div>

                    <div className="donate-section">
                        <h3>{t('donate.contactTitle')}</h3>
                        <p className="donate-contact-text">{t('donate.contactDesc')}</p>
                    </div>

                    <div className="donate-legal-link">
                        <button
                            className="legal-disclosure-btn"
                            onClick={() => window.open('/legal', '_self')}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--gray)',
                                fontSize: '0.8rem',
                                textDecoration: 'underline',
                                cursor: 'pointer',
                                marginTop: '1rem',
                                opacity: 0.7
                            }}
                        >
                            {t('donate.legalDisclosureLink')}
                        </button>
                    </div>
                </div>
            </div>

            {/* App Background Modal */}
            {
                showBackgroundModal && (
                    <div className="group-modal-overlay" onClick={() => setShowBackgroundModal(false)}>
                        <div className="group-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '80vh', overflow: 'auto' }}>
                            <h3>{t('donate.appBackground')}</h3>
                            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8', textAlign: 'left' }}>
                                {t('donate.backgroundStory')}
                            </div>
                            <button
                                className="close-modal-btn"
                                onClick={() => setShowBackgroundModal(false)}
                                style={{ marginTop: '1.5rem' }}
                            >
                                {t('recapModal.close')}
                            </button>
                        </div>
                    </div>
                )
            }
            <Footer />
        </div>
    );
};

export default Donate;
