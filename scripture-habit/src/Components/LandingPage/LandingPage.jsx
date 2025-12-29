import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../Context/LanguageContext';
import Button from '../Button/Button';
import './LandingPage.css';
import Footer from '../Footer/Footer';
import { UilGlobe } from '@iconscout/react-unicons';

const LandingPage = () => {
    const { t, language, setLanguage } = useLanguage();
    const navigate = useNavigate();
    const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

    const languages = [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'ja', name: '日本語', flag: '🇯🇵' },
        { code: 'pt', name: 'Português', flag: '🇧🇷' },
        { code: 'es', name: 'Español', flag: '🇪🇸' },
        { code: 'zho', name: '繁體中文', flag: '🇹🇼' },
        { code: 'ko', name: '한국어', flag: '🇰🇷' },
        { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
        { code: 'th', name: 'ไทย', flag: '🇹🇭' },
        { code: 'tl', name: 'Tagalog', flag: '🇵🇭' },
        { code: 'sw', name: 'Kiswahili', flag: '🇰🇪' },
    ];

    const currentLang = languages.find(l => l.code === language) || languages[0];

    const features = [
        { key: 'sharing' },
        { key: 'rule' },
        { key: 'ai' },
        { key: 'link' },
        { key: 'recommend' }
    ];

    return (
        <div className="LandingPageRoot">
            <div className="LandingGlass">
                {/* Click outside to close lang menu */}
                {isLangMenuOpen && <div className="lang-menu-backdrop" onClick={() => setIsLangMenuOpen(false)}></div>}

                {/* Language Selector Overlay */}
                <div className="lang-selector-container">
                    <button
                        className="lang-selector-btn"
                        onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                    >
                        <UilGlobe size="20" />
                        <span>{currentLang.flag} {currentLang.name}</span>
                    </button>

                    {isLangMenuOpen && (
                        <div className="lang-dropdown">
                            {languages.map((lang) => (
                                <div
                                    key={lang.code}
                                    className={`lang-option ${language === lang.code ? 'active' : ''}`}
                                    onClick={() => {
                                        setLanguage(lang.code);
                                        setIsLangMenuOpen(false);
                                    }}
                                >
                                    <span className="lang-flag">{lang.flag}</span>
                                    <span className="lang-name">{lang.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Hero Section */}
                <header className="hero-section">
                    <div className="hero-content">
                        <h1 className="hero-title">{t('landing.hero.title')}</h1>
                        <p className="hero-subtitle">{t('landing.hero.subtitle')}</p>
                        <Button
                            className="cta-button primary-cta"
                            onClick={() => navigate('/welcome')}
                        >
                            {t('landing.hero.cta')}
                        </Button>
                    </div>
                </header>

                {/* Features Section */}
                <section className="features-section">
                    <h2 className="section-title">{t('landing.features.title')}</h2>
                    <div className="features-grid">
                        {features.map((feature) => (
                            <div key={feature.key} className="feature-card">
                                <h3 className="feature-name">{t(`landing.features.${feature.key}.title`)}</h3>
                                <p className="feature-desc">{t(`landing.features.${feature.key}.desc`)}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Unity Section */}
                <section className="unity-section">
                    <div className="unity-content">
                        <div className="unity-visual">
                            <div className="sun-glow"></div>
                            <div className="unity-percentage">100%</div>
                        </div>
                        <div className="unity-text">
                            <h2 className="section-title">{t('landing.unity.title')}</h2>
                            <p className="section-desc">{t('landing.unity.desc')}</p>
                        </div>
                    </div>
                </section>

                {/* Final CTA Section */}
                <section className="final-cta-section">
                    <h2 className="section-title">{t('landing.finalCta.title')}</h2>
                    <Button
                        className="cta-button final-cta"
                        onClick={() => navigate('/welcome')}
                    >
                        {t('landing.finalCta.button')}
                    </Button>
                </section>

                <Footer />
            </div>
        </div>
    );
};

export default LandingPage;
