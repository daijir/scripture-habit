import React, { useMemo } from 'react';
import { detectInAppBrowser, getAndroidIntentUrl } from '../../Utils/browserDetection';
import './BrowserWarningModal.css';
import { UilCheckCircle, UilInfoCircle, UilCopyAlt, UilExternalLinkAlt } from '@iconscout/react-unicons';
import { toast } from 'react-toastify';

const BrowserWarningModal = ({ isOpen, onClose, onContinue, t }) => {
    const { detectedApp, isAndroid, isIos } = useMemo(() => {
        const ua = navigator.userAgent || navigator.vendor || window.opera;
        return {
            detectedApp: detectInAppBrowser(),
            isAndroid: /Android/i.test(ua),
            isIos: /iPhone|iPad|iPod/i.test(ua)
        };
    }, []);

    const getCopyButtonText = () => {
        if (isIos) return t('browserWarning.copyLinkIos');
        if (isAndroid) return t('browserWarning.copyLinkAndroid');
        return t('browserWarning.copyLinkDefault');
    };

    const handleActionClick = () => {
        if (isAndroid) {
            // On Android, try to launch Chrome via Intent
            window.location.href = getAndroidIntentUrl();
            // Also copy to clipboard as fallback
            navigator.clipboard.writeText(window.location.href);
        } else {
            // On iOS/others, copy to clipboard
            navigator.clipboard.writeText(window.location.href);
            toast.info(t('browserWarning.linkCopied'), {
                position: "bottom-center",
                autoClose: 2000,
                hideProgressBar: true,
                closeOnClick: true,
                pauseOnHover: false,
                draggable: true,
                theme: "colored",
            });
        }
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
                            <span>
                                {detectedApp === 'facebook'
                                    ? (isIos ? t('browserWarning.howToOpen.facebook_ios') : t('browserWarning.howToOpen.facebook_android'))
                                    : t(`browserWarning.howToOpen.${detectedApp}`)}
                            </span>
                        </div>
                    </div>
                )}

                <div className="browser-action-buttons">
                    <button className="browser-copy-btn" onClick={handleActionClick}>
                        <UilCopyAlt size="20" />
                        {getCopyButtonText()}
                    </button>
                    <button className="browser-continue-btn" onClick={onContinue}>
                        <UilExternalLinkAlt size="20" />
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
