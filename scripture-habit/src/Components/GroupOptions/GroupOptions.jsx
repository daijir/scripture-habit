import React from 'react';
import { Link } from 'react-router-dom';
import './GroupOptions.css';
import { useLanguage } from '../../Context/LanguageContext';

const GroupOptions = () => {
    const { t } = useLanguage();

    return (
        <div className="App GroupOptions">
            <div className="AppGlass options-container">
                <h2>{t('groupOptions.title')}</h2>
                <p className="subtitle">{t('groupOptions.subtitle')}</p>

                <div className="options-grid">
                    <Link to="/join-group" className="option-card join-card">
                        <div className="icon">🔍</div>
                        <h3>{t('groupOptions.joinGroupTitle')}</h3>
                        <p>{t('groupOptions.joinGroupDesc')}</p>
                    </Link>

                    <Link to="/group-form" className="option-card create-card">
                        <div className="icon">✨</div>
                        <h3>{t('groupOptions.createGroupTitle')}</h3>
                        <p>{t('groupOptions.createGroupDesc')}</p>
                    </Link>
                </div>

                <Link to="/dashboard" className="back-link">
                    {t('groupOptions.backToDashboard')}
                </Link>
            </div>
        </div>
    );
};

export default GroupOptions;
