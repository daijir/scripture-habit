import React, { useMemo } from 'react';
import './BrowserWarningModal.css';
import { UilCheckCircle, UilTimesCircle, UilInfoCircle } from '@iconscout/react-unicons';

const BrowserWarningModal = ({ isOpen, onClose, onContinue, t }) => {
    const detectedApp = useMemo(() => {
        const ua = navigator.userAgent || navigator.vendor || window.opera;
        if (/Line\//i.test(ua)) return 'line';
        if (/Instagram/i.test(ua)) return 'instagram';
        if (/FBAN|FBAV/i.test(ua)) return 'messenger';
        if (/WhatsApp/i.test(ua)) return 'whatsapp';
        return null;
    }, []);

    if (!isOpen) return null;

    return (
        <div className="browser-warning-overlay">
            <div className="browser-warning-modal">
                <div className="modal-header">
                    <h2>{t('browserWarning.modalTitle')}</h2>
                </div>

                <p className="browser-warning-description">
                    {t('browserWarning.modalDescription')}
                </p>

                {detectedApp && (
                    <div className="in-app-instruction">
                        <div className="instruction-header">
                            <UilInfoCircle size="20" className="info-icon" />
                            <span>{t(`browserWarning.howToOpen.${detectedApp}`)}</span>
                        </div>
                    </div>
                )}

                <div className="browser-comparison">
                    <div className="comparison-group not-recommended">
                        <h3>{t('browserWarning.notRecommended')}</h3>
                        <div className="browser-icons">
                            <div className="browser-icon-item">
                                <img src="/images/line.png" alt="LINE" className="browser-icon-img" />
                                <UilTimesCircle className="status-mark x-mark" size="24" />
                            </div>
                            <div className="browser-icon-item">
                                <img src="/images/messenger.png" alt="Messenger" className="browser-icon-img" />
                                <UilTimesCircle className="status-mark x-mark" size="24" />
                            </div>
                            <div className="browser-icon-item">
                                <img src="/images/instagram.png" alt="Instagram" className="browser-icon-img" />
                                <UilTimesCircle className="status-mark x-mark" size="24" />
                            </div>
                            <div className="browser-icon-item">
                                <img src="/images/whatsapp.png" alt="WhatsApp" className="browser-icon-img" />
                                <UilTimesCircle className="status-mark x-mark" size="24" />
                            </div>
                        </div>
                    </div>

                    <div className="comparison-group recommended">
                        <h3>{t('browserWarning.recommended')}</h3>
                        <div className="browser-icons">
                            <div className="browser-icon-item">
                                <img src="/images/chrome.png" alt="Chrome" className="browser-icon-img" />
                                <UilCheckCircle className="status-mark o-mark" size="24" />
                            </div>
                            <div className="browser-icon-item">
                                <img src="/images/safari.png" alt="Safari" className="browser-icon-img" />
                                <UilCheckCircle className="status-mark o-mark" size="24" />
                            </div>
                            <div className="browser-icon-item">
                                <img src="/images/edge.png" alt="Edge" className="browser-icon-img" />
                                <UilCheckCircle className="status-mark o-mark" size="24" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="browser-warning-footer">
                    <button className="browser-continue-btn" onClick={onContinue}>
                        {t('browserWarning.continueButton')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BrowserWarningModal;
