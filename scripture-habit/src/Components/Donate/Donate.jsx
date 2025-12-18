import React from 'react';
import './Donate.css';
import { useLanguage } from '../../Context/LanguageContext';
import Mascot from '../Mascot/Mascot';

const Donate = ({ userData }) => {
    const { t } = useLanguage();
    const [showQR, setShowQR] = React.useState(false);

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
                </div>
            </div>
        </div>
    );
};

export default Donate;
