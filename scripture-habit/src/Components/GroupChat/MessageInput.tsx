import React from 'react';
import { UilPlus, UilTimes } from '@iconscout/react-unicons';

const MessageInput = ({
    handleSendMessage,
    isAnyModalOpen,
    replyTo,
    setReplyTo,
    t,
    textareaRef,
    newMessage,
    setNewMessage,
    handleKeyDown,
    onInputFocusChange,
    containerRef,
    inputPlaceholder,
    showAddNoteTooltip,
    handleDismissTooltip,
    setIsNewNoteOpen
}) => {
    return (
        <form
            onSubmit={handleSendMessage}
            className="send-message-form"
            style={window.innerWidth <= 768 && isAnyModalOpen ? { display: 'none' } : {}}
        >
            {replyTo && (
                <div className="reply-preview">
                    <div className="reply-info">
                        <span className="replying-to">{t('groupChat.replyingTo')} <strong>{replyTo.senderNickname}</strong></span>
                        <p className="reply-text-preview">
                            {replyTo.isNote || replyTo.isEntry
                                ? t('groupChat.studyNote')
                                : (replyTo.text ? (replyTo.text.substring(0, 50) + (replyTo.text.length > 50 ? '...' : '')) : 'Image/Note')
                            }
                        </p>
                    </div>
                    <div className="cancel-reply" onClick={() => setReplyTo(null)}>
                        <UilTimes size="16" />
                    </div>
                </div>
            )}
            <div className="input-wrapper">
                <textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (onInputFocusChange) onInputFocusChange(true);
                        // Scroll to bottom when keyboard appears on mobile
                        if (containerRef.current && window.innerWidth <= 768) {
                            setTimeout(() => {
                                containerRef.current.scrollTop = containerRef.current.scrollHeight;
                            }, 300);
                        }
                    }}
                    onBlur={() => onInputFocusChange && onInputFocusChange(false)}
                    placeholder={inputPlaceholder}
                    rows={1}
                />
                <div className="add-entry-btn-wrapper">
                    {showAddNoteTooltip && (
                        <div className="add-note-tooltip" onClick={(e) => { e.stopPropagation(); handleDismissTooltip(); }}>
                            <div className="tooltip-content">
                                {t('groupChat.addNoteTooltip')}
                            </div>
                            <div className="tooltip-arrow"></div>
                        </div>
                    )}
                    <div className="add-entry-btn" onClick={() => { setIsNewNoteOpen(true); handleDismissTooltip(); }}>
                        <UilPlus />
                    </div>
                </div>
                <button type="submit">{t('groupChat.send')}</button>
            </div>
        </form>
    );
};

export default MessageInput;
