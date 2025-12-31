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

                    <div className="donate-background-btn-container" style={{ display: 'flex', justifyContent: 'center', margin: '2rem 0' }}>
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

                            <div className="stripe-buttons-section" style={{
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '1.5rem',
                                padding: '1rem'
                            }}>
                                {/* One-off Section */}
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    width: '100%'
                                }}>
                                    <p style={{ fontWeight: '600', color: 'var(--gray)', margin: 0 }}>
                                        {t('donate.stripeOneOffButton').split(' (')[0]}
                                    </p>
                                    <div style={{
                                        display: 'flex',
                                        gap: '1rem',
                                        flexWrap: 'wrap',
                                        justifyContent: 'center'
                                    }}>
                                        <button
                                            className="donate-action-btn stripe-btn"
                                            onClick={() => window.open('https://buy.stripe.com/3cI6oJ0KO9Xd1aUcBjdby00', '_blank')}
                                            style={{
                                                background: '#635bff',
                                                color: '#fff',
                                                padding: '0.8rem 1.5rem'
                                            }}
                                        >
                                            💳 $1
                                        </button>
                                        <button
                                            className="donate-action-btn stripe-btn"
                                            onClick={() => window.open('https://buy.stripe.com/00wfZjeBE7P53j2atbdby04', '_blank')}
                                            style={{
                                                background: '#635bff',
                                                color: '#fff',
                                                padding: '0.8rem 1.5rem'
                                            }}
                                        >
                                            💳 $3
                                        </button>
                                        <button
                                            className="donate-action-btn stripe-btn"
                                            onClick={() => window.open('https://buy.stripe.com/dRmfZj8dg6L1f1KdFndby06', '_blank')}
                                            style={{
                                                background: '#635bff',
                                                color: '#fff',
                                                padding: '0.8rem 1.5rem'
                                            }}
                                        >
                                            💳 $5
                                        </button>
                                    </div>
                                </div>

                                {/* Monthly Section */}
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    width: '100%'
                                }}>
                                    <p style={{ fontWeight: '600', color: 'var(--gray)', margin: 0 }}>
                                        {t('donate.stripeMonthlyButton').split(' (')[0]}
                                    </p>
                                    <div style={{
                                        display: 'flex',
                                        gap: '1rem',
                                        flexWrap: 'wrap',
                                        justifyContent: 'center'
                                    }}>
                                        <button
                                            className="donate-action-btn stripe-btn"
                                            onClick={() => window.open('https://buy.stripe.com/28E7sN2SWc5l8Dm7gZdby01', '_blank')}
                                            style={{
                                                background: '#32325d',
                                                color: '#fff',
                                                padding: '0.8rem 1.5rem'
                                            }}
                                        >
                                            ✨ $1 / mo
                                        </button>
                                        <button
                                            className="donate-action-btn stripe-btn"
                                            onClick={() => window.open('https://buy.stripe.com/cNi9AV0KOc5l06Q1WFdby02', '_blank')}
                                            style={{
                                                background: '#32325d',
                                                color: '#fff',
                                                padding: '0.8rem 1.5rem'
                                            }}
                                        >
                                            ✨ $3 / mo
                                        </button>
                                        <button
                                            className="donate-action-btn stripe-btn"
                                            onClick={() => window.open('https://buy.stripe.com/dRm14p9hk1qH8DmgRzdby03', '_blank')}
                                            style={{
                                                background: '#32325d',
                                                color: '#fff',
                                                padding: '0.8rem 1.5rem'
                                            }}
                                        >
                                            ✨ $5 / mo
                                        </button>
                                    </div>
                                </div>
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
