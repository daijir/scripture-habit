import React, { useMemo } from 'react';
import './Mascot.css';
import { useLanguage } from '../../Context/LanguageContext';

const Mascot = ({ userData, onClick, customMessage = null, reversed = false }) => {
  const { t, language } = useLanguage();
  const mascotImg = '/images/mascot.png';

  const isDoneToday = useMemo(() => {
    if (!userData || !userData.lastPostDate) return false;

    let timeZone = userData.timeZone || 'UTC';
    try {
      Intl.DateTimeFormat(undefined, { timeZone });
    } catch (e) {
      timeZone = 'UTC';
    }

    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone });

    let lastPostDate;
    if (userData.lastPostDate && typeof userData.lastPostDate.toDate === 'function') {
      lastPostDate = userData.lastPostDate.toDate();
    } else {
      lastPostDate = new Date(userData.lastPostDate);
    }

    if (isNaN(lastPostDate.getTime())) return false;
    const lastPostDateStr = lastPostDate.toLocaleDateString('en-CA', { timeZone });

    return todayStr === lastPostDateStr;
  }, [userData]);

  const streak = userData?.streakCount || 0;

  const getMessage = () => {
    if (customMessage) return customMessage;

    if (isDoneToday) {
      if (streak >= 7) {
        return t('mascot.streakCelebration', { streak });
      }
      return t('mascot.doneToday');
    } else {
      return t('mascot.promptToday');
    }
  };

  return (
    <div className={`mascot-container ${isDoneToday ? 'is-done' : ''} ${reversed ? 'reversed' : ''}`} onClick={onClick}>
      <div className="mascot-image-wrapper">
        <img src={mascotImg} alt="Scripture Habit Mascot - Your guide to daily study" className="mascot-image" />
        {isDoneToday && <div className="mascot-sparkles">✨</div>}
      </div>
      <div className="mascot-bubble">
        <p className="mascot-text">{getMessage()}</p>
        <div className="mascot-bubble-tail"></div>
      </div>
    </div>
  );
};

export default Mascot;
