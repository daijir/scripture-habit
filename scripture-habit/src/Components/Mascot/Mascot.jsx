import React, { useMemo } from 'react';
import './Mascot.css';
import { useLanguage } from '../../Context/LanguageContext';

const Mascot = ({ userData, onClick }) => {
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
    if (isDoneToday) {
      if (streak >= 7) {
        return language === 'ja'
          ? `すごい！${streak}日連続だよ！`
          : `Amazing! ${streak} day streak!`;
      }
      return language === 'ja'
        ? "今日の学習お疲れ様！明日も待ってるよ！"
        : "Great job today! See you tomorrow!";
    } else {
      return language === 'ja'
        ? "今日の聖典はもう読んだ？一緒に学ぼう！"
        : "Have you read today? Let's study together!";
    }
  };

  return (
    <div className={`mascot-container ${isDoneToday ? 'is-done' : ''}`} onClick={onClick}>
      <div className="mascot-image-wrapper">
        <img src={mascotImg} alt="Mascot" className="mascot-image" />
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
