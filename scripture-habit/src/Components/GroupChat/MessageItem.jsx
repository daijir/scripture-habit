import React from 'react';
import ReactMarkdown from 'react-markdown';
import NoteDisplay from '../NoteDisplay/NoteDisplay';
import { getGospelLibraryUrl } from '../../Utils/gospelLibraryMapper';

const MessageItem = ({
  msg,
  userData,
  t,
  handleLongPressStart,
  handleLongPressEnd,
  handleLongPressMove,
  handleEditMessage,
  handleDeleteMessageClick,
  handleReply,
  handleTranslateMessage,
  translatingIds,
  handleToggleReaction,
  handleReportClick,
  handleUserProfileClick,
  groupData,
  translatedTexts,
  language,
  handleShowReactions,
  membersMap
}) => {
  return (
    <>
      {msg.senderId === 'system' || msg.isSystemMessage ? (
        <div id={`message-${msg.id}`} className={`message system-message ${msg.messageType === 'streakAnnouncement' ? 'streak-announcement' : ''} ${msg.messageType === 'unityAnnouncement' ? 'unity-announcement' : ''}`}>
          <div className="message-content">
            {msg.messageType === 'unityAnnouncement' && (
              <div className="unity-announcement-body">
                <img src="/images/mascot.png" alt="Mascot" className="mascot-avatar-celestial" />
              </div>
            )}
            <ReactMarkdown>
              {(() => {
                // New format: has messageType and messageData
                if (msg.messageType === 'streakAnnouncement' && msg.messageData) {
                  return t('groupChat.streakAnnouncement', {
                    nickname: msg.messageData.nickname,
                    streak: msg.messageData.streak
                  });
                }

                if (msg.messageType === 'userJoined' && msg.messageData) {
                  return t('groupChat.userJoined', {
                    nickname: msg.messageData.nickname
                  });
                }

                if (msg.messageType === 'userLeft' && msg.messageData) {
                  return t('groupChat.userLeft', {
                    nickname: msg.messageData.nickname
                  });
                }

                if (msg.messageType === 'unityAnnouncement') {
                  return t('groupChat.unityAnnouncement');
                }

                if (msg.messageType === 'weeklyRecap') {
                  // Just return text, maybe bold the title if we want, but markdown handles it.
                  // The text comes with "Weekly Reflection: ..." or similar
                  return msg.text;
                }

                // Legacy format: parse from text
                // Streak patterns for various languages:
                const streakPatterns = [
                  /\*\*(.+?) reached a (\d+) day streak/,           // English
                  /\*\*(.+?)さんが(\d+)日連続/,                      // Japanese
                  /\*\*(.+?) alcançou uma ofensiva de (\d+) dias/, // Portuguese
                  /\*\*(.+?) 達成了 (\d+) 天連續紀錄/,              // Chinese
                  /\*\*¡?(.+?) alcanzó una racha de (\d+) días/,     // Spanish
                  /\*\*(.+?) đã đạt chuỗi (\d+) ngày/,             // Vietnamese
                  /\*\*(.+?) ทำต่อเนื่องได้ (\d+) วันแล้ว/,             // Thai
                  /\*\*(.+?)님이 (\d+)일 연속 기록/,                 // Korean
                  /\*\*Naabot ni (.+?) ang (\d+) araw/,             // Tagalog
                  /\*\*(.+?) amefikisha mfululizo wa siku (\d+)/,   // Swahili
                ];

                for (const pattern of streakPatterns) {
                  const match = msg.text?.match(pattern);
                  if (match) {
                    const nickname = match[1];
                    const streak = match[2];
                    return t('groupChat.streakAnnouncement', { nickname, streak });
                  }
                }

                // Legacy join patterns
                const joinPatterns = [
                  /\*\*(.+?)\*\* joined the group/,      // English
                  /\*\*(.+?)\*\*さんがグループに参加/,    // Japanese
                  /\*\*(.+?)\*\* entrou no grupo/,       // Portuguese
                  /\*\*(.+?)\*\* 加入了群組/,            // Chinese
                  /\*\*(.+?)\*\* se unió al grupo/,      // Spanish
                  /\*\*(.+?)\*\* đã tham gia nhóm/,      // Vietnamese
                  /\*\*(.+?)\*\* เข้าร่วมกลุ่มแล้ว/,         // Thai
                  /\*\*(.+?)\*\*님이 그룹에 참여/,        // Korean
                  /\*\*(.+?)\*\* sumali sa grupo/,       // Tagalog
                  /\*\*(.+?)\*\* amejiunga na kikundi/,  // Swahili
                ];

                for (const pattern of joinPatterns) {
                  const match = msg.text?.match(pattern);
                  if (match) {
                    return t('groupChat.userJoined', { nickname: match[1] });
                  }
                }

                // Legacy leave patterns
                const leavePatterns = [
                  /\*\*(.+?)\*\* left the group/,        // English
                  /\*\*(.+?)\*\*さんがグループを退会/,    // Japanese
                  /\*\*(.+?)\*\* saiu do grupo/,         // Portuguese
                  /\*\*(.+?)\*\* 離開了群組/,            // Chinese
                  /\*\*(.+?)\*\* salió del grupo/,       // Spanish
                  /\*\*(.+?)\*\* đã rời nhóm/,           // Vietnamese
                  /\*\*(.+?)\*\* ออกจากกลุ่มแล้ว/,          // Thai
                  /\*\*(.+?)\*\*님이 그룹을 나갔/,         // Korean
                  /\*\*(.+?)\*\* umalis sa grupo/,        // Tagalog
                  /\*\*(.+?)\*\* ameondoka kwenye kikundi/, // Swahili
                ];

                for (const pattern of leavePatterns) {
                  const match = msg.text?.match(pattern);
                  if (match) {
                    return t('groupChat.userLeft', { nickname: match[1] });
                  }
                }

                // Inactivity Removal Pattern
                const inactivityPattern = /👋 \*\*(\d+) member\(s\)\*\* were removed due to inactivity \(3\+ days\)\./;
                const inactivityMatch = msg.text?.match(inactivityPattern);
                if (inactivityMatch) {
                  return t('groupChat.inactivityRemoval', { count: inactivityMatch[1] });
                }

                // No match found, return original text
                return msg.text;
              })()}
            </ReactMarkdown>
          </div>
        </div>
      ) : (
        <div id={`message-${msg.id}`} className={`message-wrapper ${msg.senderId === userData?.uid ? 'sent' : 'received'}`}>
          {msg.senderId !== userData?.uid && (
            <div
              className="message-avatar"
              onClick={(e) => { e.stopPropagation(); handleUserProfileClick(msg.senderId); }}
              style={{ cursor: 'pointer', overflow: 'hidden' }}
            >
              {(msg.senderPhotoURL || membersMap?.[msg.senderId]?.photoURL) ? (
                <img
                  src={msg.senderPhotoURL || membersMap?.[msg.senderId]?.photoURL}
                  alt=""
                  className="profile-avatar-img"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                msg.senderNickname ? msg.senderNickname.substring(0, 1).toUpperCase() : '?'
              )}
            </div>
          )}
          <div
            className={`message ${msg.senderId === userData?.uid ? 'sent' : 'received'}`}
            onClick={(e) => {
              // Ignore clicks on links so they can navigate normally
              if (e.target.tagName !== 'A') {
                handleLongPressStart(msg, e);
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            {/* Hover action buttons */}
            <div className={`message-hover-actions ${msg.senderId === userData?.uid ? 'sent' : 'received'}`}>
              {msg.senderId === userData?.uid ? (
                <>
                  <button
                    className="hover-action-btn"
                    onClick={(e) => { e.stopPropagation(); handleEditMessage(msg); }}
                    title={t('groupChat.editMessage')}
                  >
                    ✏️
                  </button>
                  <button
                    className="hover-action-btn delete"
                    onClick={(e) => { e.stopPropagation(); handleDeleteMessageClick(msg); }}
                    title={t('groupChat.deleteMessage')}
                  >
                    🗑️
                  </button>
                  <button
                    className="hover-action-btn"
                    onClick={(e) => { e.stopPropagation(); handleReply(msg); }}
                    title={t('groupChat.reply')}
                  >
                    ↩️
                  </button>
                  <button
                    className={`hover-action-btn ${translatingIds.has(msg.id) ? 'translating' : ''}`}
                    onClick={(e) => { e.stopPropagation(); handleTranslateMessage(msg); }}
                    title={t('groupChat.translate')}
                  >
                    {translatingIds.has(msg.id) ? '⏳' : '✨'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="hover-action-btn"
                    onClick={(e) => { e.stopPropagation(); handleToggleReaction(msg); }}
                    title={msg.reactions?.find(r => r.odU === userData?.uid) ? t('groupChat.unlike') : t('groupChat.like')}
                  >
                    {msg.reactions?.find(r => r.odU === userData?.uid) ? '👍' : '👍'}
                  </button>
                  <button
                    className="hover-action-btn"
                    onClick={(e) => { e.stopPropagation(); handleReply(msg); }}
                    title={t('groupChat.reply')}
                  >
                    ↩️
                  </button>
                  <button
                    className={`hover-action-btn ${translatingIds.has(msg.id) ? 'translating' : ''}`}
                    onClick={(e) => { e.stopPropagation(); handleTranslateMessage(msg); }}
                    title={t('groupChat.translate')}
                  >
                    {translatingIds.has(msg.id) ? '⏳' : '✨'}
                  </button>
                  <button
                    className="hover-action-btn report-btn"
                    onClick={(e) => { e.stopPropagation(); handleReportClick(msg); }}
                    title={t('groupChat.report')}
                  >
                    🚩
                  </button>
                </>
              )}
            </div>
            <span
              className="sender-name"
              onClick={(e) => { e.stopPropagation(); handleUserProfileClick(msg.senderId); }}
              style={{ cursor: 'pointer' }}
            >
              {msg.senderNickname}{msg.isEdited && <span className="edited-indicator"> ({t('groupChat.messageEdited')})</span>}
            </span>
            <div className="message-bubble-row" style={{ display: 'flex', alignItems: 'flex-end', gap: '5px' }}>
              {msg.senderId === userData?.uid && (
                <div className="message-status-column" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                  {(() => {
                    if (!groupData?.memberLastReadAt || !msg.createdAt) return null;
                    const msgTime = msg.createdAt.toMillis ? msg.createdAt.toMillis() : (msg.createdAt.seconds * 1000);
                    let readCount = 0;
                    Object.keys(groupData.memberLastReadAt).forEach(uid => {
                      if (uid === msg.senderId) return;
                      const readAt = groupData.memberLastReadAt[uid];
                      if (!readAt) return;
                      const readTime = readAt.toMillis ? readAt.toMillis() : (readAt.seconds * 1000);
                      if (readTime >= msgTime) readCount++;
                    });
                    if (readCount === 0) return null;
                    return (
                      <span className="read-status" style={{ fontSize: '0.65rem', color: '#4A5568' }}>
                        {t('groupChat.readStatus', { count: readCount })}
                      </span>
                    );
                  })()}
                  <span className="message-time" style={{ fontSize: '0.7rem', color: 'var(--gray)', whiteSpace: 'nowrap' }}>
                    {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              )}
              <div className="message-bubble-column" style={{ display: 'flex', flexDirection: 'column', maxWidth: '100%', alignItems: msg.senderId === userData?.uid ? 'flex-end' : 'flex-start' }}>
                {msg.replyTo && (
                  <div className="reply-context-label">
                    <span className="reply-context-prefix">{t('groupChat.replyTo')} </span>
                    <span className="reply-context-name">{msg.replyTo.senderNickname}</span>
                    <span className="reply-context-separator">: </span>
                    <span className="reply-context-text">
                      {msg.replyTo.isNote || msg.replyTo.text?.startsWith('📖 **New Study') || msg.replyTo.text?.startsWith('**New Study')
                        ? t('groupChat.studyNote')
                        : msg.replyTo.text
                      }
                    </span>
                  </div>
                )}
                <div className="message-content">
                  {msg.text && (
                    (msg.isNote || msg.isEntry) ? (
                      <div className="entry-message-content">
                        <NoteDisplay
                          text={msg.text}
                          isSent={msg.senderId === userData?.uid}
                          translatedText={translatedTexts[msg.id]}
                        />
                        <div style={{ marginTop: '0.2rem' }}></div>
                        {(() => {


                          // 1. Better search for URL specifically (most important for GC/BYU/Other)
                          const urlMatch = msg.text.match(/(?:\*\*|)(?:Url|リンク)(?:\*\*|)(?::|：)\s*(.*?)(?:\n|$)/i);
                          // 2. Generic label search (for scriptures)
                          const labelMatch = msg.text.match(/(?:\*\*|)(?:Chapter|Talk|お話|Speech|スピーチ|Title|タイトル|章)(?:\*\*|)(?::|：)\s*(.*?)(?:\n|$)/i);
                          const scriptureMatch = msg.text.match(/(?:\*\*|)(?:Scripture|Category|カテゴリ)(?:\*\*|)(?::|：)\s*(.*?)(?:\n|$)/i);

                          // Aggressively strip asterisks and trim
                          const scripture = (msg.scripture || (scriptureMatch ? scriptureMatch[1].trim() : null))?.replace(/\*/g, '').trim();
                          // Prioritize urlMatch result over labelMatch
                          const chapterValue = (msg.chapter || (urlMatch ? urlMatch[1].trim() : (labelMatch ? labelMatch[1].trim() : null)))?.replace(/\*/g, '').trim();



                          if (scripture && chapterValue) {
                            const scripLower = scripture.toLowerCase();
                            const isOther = scripLower.includes('other') || scripLower.includes('その他') || scripture === '';
                            const isBYU = scripLower.includes('byu');

                            // CASE A: Direct URL (Other, GC, BYU with full URL)
                            if (chapterValue.toLowerCase().startsWith('http')) {

                              let linkLabel = t('dashboard.readInGospelLibrary');
                              if (isOther) linkLabel = t('dashboard.readStudyMaterial');
                              else if (isBYU) linkLabel = t('dashboard.goToByuSpeech');



                              return (
                                <a
                                  href={chapterValue}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className={`gospel-link ${msg.senderId === userData?.uid ? 'sent' : ''}`}
                                >
                                  {linkLabel}
                                </a>
                              );
                            }

                            // CASE B: Scripture reference or GC shortcode (handled by Mapper)
                            const url = getGospelLibraryUrl(scripture, chapterValue, language);


                            if (url) {
                              return (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className={`gospel-link ${msg.senderId === userData?.uid ? 'sent' : ''}`}
                                >
                                  {isBYU ? t('dashboard.goToByuSpeech') : (isOther ? t('dashboard.readStudyMaterial') : t('dashboard.readInGospelLibrary'))}
                                </a>
                              );

                            }
                          }
                          return null;
                        })()}
                      </div>
                    ) : (
                      <NoteDisplay
                        text={msg.text}
                        isSent={msg.senderId === userData?.uid}
                        translatedText={translatedTexts[msg.id]}
                      />
                    )
                  )}
                </div>
              </div>
              {msg.senderId !== userData?.uid && (
                <span className="message-time" style={{ fontSize: '0.7rem', color: 'var(--gray)', marginBottom: '2px', whiteSpace: 'nowrap' }}>
                  {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              )}
            </div>
            {/* Reactions display */}
            {msg.reactions && msg.reactions.length > 0 && (
              <div
                className={`message-reactions ${msg.senderId === userData?.uid ? 'sent' : 'received'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleShowReactions(msg.reactions);
                }}
              >
                <span className="reaction-emoji">👍</span>
                <span className="reaction-count">{msg.reactions.length}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default MessageItem;
