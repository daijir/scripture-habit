import React from 'react';
import { useLanguage } from '../../Context/LanguageContext';
import { UilArrowLeft } from '@iconscout/react-unicons';
import { useNavigate } from 'react-router-dom';
import './LegalDisclosure.css';

const LegalDisclosure = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();

    const legalInfo = [
        { label: t('legalDisclosure.provider'), value: 'Scripture Habit' },
        { label: t('legalDisclosure.representative'), value: '相根 大治郎' },
        { label: t('legalDisclosure.address'), value: t('legalDisclosure.requestDisclosure') },
        { label: t('legalDisclosure.phone'), value: t('legalDisclosure.requestDisclosure') },
        { label: t('legalDisclosure.email'), value: 'dazhilangxianggen@gmail.com' },
        { label: t('legalDisclosure.price'), value: t('legalDisclosure.priceDetail') },
        { label: t('legalDisclosure.paymentTiming'), value: t('legalDisclosure.paymentTimingDetail') },
        { label: t('legalDisclosure.paymentMethod'), value: t('legalDisclosure.onlinePaymentMethod') },
        { label: t('legalDisclosure.deliveryTiming'), value: t('legalDisclosure.deliveryTimingDetail') },
        { label: t('legalDisclosure.cancellation'), value: t('legalDisclosure.cancelDetail') },
        { label: t('legalDisclosure.environment'), value: t('legalDisclosure.environmentDetail') },
    ];

    return (
        <div className="LegalDisclosure">
            <div className="legal-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <UilArrowLeft size="24" />
                </button>
                <h1>{t('legalDisclosure.title')}</h1>
            </div>

            <div className="legal-content">
                <div className="legal-table">
                    {legalInfo.map((item, index) => (
                        <div key={index} className="legal-row">
                            <div className="legal-label">{item.label}</div>
                            <div className="legal-value">{item.value}</div>
                        </div>
                    ))}
                </div>

                <div className="legal-footer-note">
                    <p>
                        ※個人開発のため、所在地および電話番号については、開示を希望される場合にメールにてご請求いただければ遅滞なく提供いたします。
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LegalDisclosure;
