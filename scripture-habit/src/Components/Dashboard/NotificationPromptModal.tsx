import React from 'react';
import './NotificationPromptModal.css';

const NotificationPromptModal = ({ isOpen, onClose, onConfirm, t }) => {
    if (!isOpen) return null;

    return (
        <div className="notif-modal-overlay">
            <div className="notif-modal-content">
                <div className="notif-modal-icon">🔔</div>
                <h2 className="notif-modal-title">{t('dashboard.notificationPrompt.title')}</h2>
                <p className="notif-modal-description">
                    {t('dashboard.notificationPrompt.description')}
                </p>
                <div className="notif-modal-actions">
                    <button className="notif-btn primary" onClick={onConfirm}>
                        {t('dashboard.notificationPrompt.enable')}
                    </button>
                    <button className="notif-btn secondary" onClick={onClose}>
                        {t('dashboard.notificationPrompt.later')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificationPromptModal;
