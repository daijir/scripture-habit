import React, { useState } from 'react';
import './Sidebar.css';
import { SidebarData } from '../../Data/Data';
import { UilSignOutAlt, UilPlusCircle, UilUsersAlt } from '@iconscout/react-unicons';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';
import { useLanguage } from '../../Context/LanguageContext.jsx';

const Sidebar = ({ selected, setSelected, userGroups = [], activeGroupId, setActiveGroupId, hideMobile = false }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const DashboardIcon = SidebarData[0].icon;
  const NotesIcon = SidebarData[1].icon;
  const ProfileIcon = SidebarData[2].icon;

  const handleGroupClick = (groupId) => {
    setActiveGroupId(groupId);
    setSelected(2); // Switch to GroupChat view
    setShowGroupModal(false);
  };

  const getGroupStatusEmoji = (group) => {
    const percentage = getUnityPercentage(group);

    if (percentage === 100) return '🌕';
    if (percentage >= 75) return '🌔';
    if (percentage >= 50) return '🌓';
    if (percentage >= 25) return '🌒';
    return '🌑';
  };

  const getUnityPercentage = (group) => {
    if (!group || !group.members || group.members.length === 0) return 0;

    // Check if we have activity data for today
    const todayStr = new Date().toDateString();

    if (group.dailyActivity && group.dailyActivity.date === todayStr && group.dailyActivity.activeMembers) {
      const uniqueCount = new Set(group.dailyActivity.activeMembers).size;
      return Math.round((uniqueCount / group.members.length) * 100);
    }

    return 0;
  };

  const handleSignOut = () => {
    setShowSignOutModal(true);
  };

  const confirmSignOut = () => {
    auth.signOut();
    navigate('/login');
    setShowSignOutModal(false);
  };

  return (
    <>
      <div className={`Sidebar ${hideMobile ? 'hide-mobile' : ''}`}>
        <div className='logo'>
          Scripture Habit
        </div>
        <div className="menu">
          {/* Dashboard */}
          <div className={selected === 0 ? 'menuItem active' : 'menuItem'}
            onClick={() => setSelected(0)}
          >
            <DashboardIcon />
            <span>{t('sidebar.dashboard')}</span>
          </div>

          {/* My Notes */}
          <div className={selected === 1 ? 'menuItem active' : 'menuItem'}
            onClick={() => setSelected(1)}
          >
            <NotesIcon />
            <span>{t('sidebar.myNotes')}</span>
          </div>

          {/* Languages */}
          <div className={selected === 3 ? 'menuItem active' : 'menuItem'}
            onClick={() => setSelected(3)}
          >
            <ProfileIcon />
            <span>{t('sidebar.profile')}</span>
          </div>

          {/* Desktop Groups Section */}
          <div className="groups-section desktop-groups">
            <div className="menu-header">
              {t('sidebar.myGroups')} <span style={{ fontSize: '1.2em' }}>({userGroups.length}/12)</span>
            </div>
            {userGroups.map((group) => (
              <div
                key={group.id}
                className={`menuItem ${selected === 2 && activeGroupId === group.id ? 'active' : ''}`}
                onClick={() => handleGroupClick(group.id)}
              >
                <span style={{ fontSize: '1.2rem', marginRight: '2px' }}>{getGroupStatusEmoji(group)}</span>
                <span style={{ fontSize: '0.75rem', marginRight: '4px', color: getUnityPercentage(group) === 100 ? '#B8860B' : 'var(--gray)', fontWeight: getUnityPercentage(group) === 100 ? 'bold' : 'normal' }}>
                  {getUnityPercentage(group)}%
                </span>
                <span className="group-name-sidebar">{group.name}</span>
                {group.unreadCount > 0 && (
                  <span className="unread-badge">{group.unreadCount > 99 ? '99+' : group.unreadCount}</span>
                )}
              </div>
            ))}

            {userGroups.length < 12 && (
              <div className="menuItem create-group-item" onClick={() => navigate('/group-options')}>
                <UilPlusCircle />
                <span>{t('sidebar.joinCreateGroup')}</span>
              </div>
            )}
          </div>

          {/* Mobile Groups Trigger */}
          <div className={`menuItem mobile-groups-trigger ${selected === 2 ? 'active' : ''}`}
            onClick={() => setShowGroupModal(true)}
          >
            <UilUsersAlt />
            {userGroups.some(g => g.unreadCount > 0) && (
              <span className="unread-dot"></span>
            )}
          </div>

          <div className="menuItem sign-out" onClick={handleSignOut}>
            <UilSignOutAlt />
            <span>{t('sidebar.signOut')}</span>
          </div>
        </div>
      </div>

      {/* Mobile Group Selection Modal */}
      {showGroupModal && (
        <div className="group-modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="group-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{t('sidebar.selectGroup')} <span style={{ fontSize: '1.2em' }}>({userGroups.length}/12)</span></h3>
            <div className="modal-group-list">
              {userGroups.map((group) => (
                <div
                  key={group.id}
                  className={`modal-group-item ${activeGroupId === group.id ? 'active-group' : ''}`}
                  onClick={() => handleGroupClick(group.id)}
                >
                  <span style={{ fontSize: '1.2rem', marginRight: '2px' }}>{getGroupStatusEmoji(group)}</span>
                  <span style={{ fontSize: '0.75rem', marginRight: '4px', color: getUnityPercentage(group) === 100 ? '#B8860B' : 'var(--gray)', fontWeight: getUnityPercentage(group) === 100 ? 'bold' : 'normal' }}>
                    {getUnityPercentage(group)}%
                  </span>
                  <span>
                    {group.name}
                    {group.members && <span style={{ fontSize: '0.85em', color: 'var(--gray)', fontWeight: 'normal', marginLeft: '4px' }}>({group.members.length})</span>}
                  </span>
                  {group.unreadCount > 0 && (
                    <span className="unread-badge" style={{ marginLeft: 'auto' }}>{group.unreadCount > 99 ? '99+' : group.unreadCount}</span>
                  )}
                </div>
              ))}
            </div>
            {userGroups.length < 12 && (
              <div className="modal-create-group" onClick={() => { navigate('/group-options'); setShowGroupModal(false); }}>
                <UilPlusCircle />
                <span>{t('sidebar.joinCreateGroup')}</span>
              </div>
            )}
            <button className="close-modal-btn" onClick={() => setShowGroupModal(false)}>{t('sidebar.close')}</button>
          </div>
        </div>
      )}

      {/* Sign Out Confirmation Modal */}
      {showSignOutModal && (
        <div className="group-modal-overlay" onClick={() => setShowSignOutModal(false)}>
          <div className="group-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '300px', textAlign: 'center' }}>
            <h3>{t('signOut.title')}</h3>
            <p>{t('signOut.message')}</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
              <button
                className="close-modal-btn"
                onClick={() => setShowSignOutModal(false)}
                style={{ marginTop: 0, flex: 1 }}
              >
                {t('signOut.cancel')}
              </button>
              <button
                className="close-modal-btn"
                onClick={confirmSignOut}
                style={{
                  marginTop: 0,
                  flex: 1,
                  background: 'var(--pink)',
                  color: 'white',
                  border: 'none'
                }}
              >
                {t('signOut.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;