import React from 'react';
import { useLanguage } from '../../Context/LanguageContext';
import './Maintenance.css';

const Maintenance = () => {
    const { t } = useLanguage();

    return (
        <div className="maintenance-container">
            <div className="maintenance-glass">
                <div className="maintenance-icon">🛠️</div>
                <h1>{t('systemErrors.underMaintenanceTitle')}</h1>
                <p>{t('systemErrors.underMaintenanceMessage')}</p>
                <div className="maintenance-footer">
                    Scripture Habit
                </div>
            </div>
        </div>
    );
};

export default Maintenance;
