import React, { useMemo } from 'react';
import { detectInAppBrowser } from '../../Utils/browserDetection';
import './BrowserWarningModal.css';
import { UilCheckCircle, UilTimesCircle, UilInfoCircle } from '@iconscout/react-unicons';

const BrowserWarningModal = ({ isOpen, onClose, onContinue, t }) => {
    const detectedApp = useMemo(() => {
        return detectInAppBrowser();
    }, []);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        alert(t('browserWarning.linkCopied'));
    };

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

                <div className="browser-action-buttons">
                    <button className="browser-copy-btn" onClick={handleCopyLink}>
                        <UilInfoCircle size="18" />
                        {t('browserWarning.copyLink')}
                    </button>
                    <button className="browser-continue-btn" onClick={onContinue}>
                        {t('browserWarning.continueButton')}
                    </button>
                </div>

                <div className="browser-comparison">
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
            </div>
        </div>
    );
};

export default BrowserWarningModal;
