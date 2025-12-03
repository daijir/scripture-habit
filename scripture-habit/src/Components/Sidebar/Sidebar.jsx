import React, { useState } from 'react';
import './Sidebar.css';
import { SidebarData } from '../../Data/Data';
import { UilSignOutAlt, UilPlusCircle, UilUsersAlt } from '@iconscout/react-unicons';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';

const Sidebar = ({ selected, setSelected, userGroups = [], activeGroupId, setActiveGroupId }) => {
  const navigate = useNavigate();
  const [showGroupModal, setShowGroupModal] = useState(false);

  const DashboardIcon = SidebarData[0].icon;
  const NotesIcon = SidebarData[1].icon;

  const handleGroupClick = (groupId) => {
    setActiveGroupId(groupId);
    setSelected(2); // Switch to GroupChat view
    setShowGroupModal(false);
  };

  const handleSignOut = () => {
    auth.signOut();
    navigate('/login');
  };

  return (
    <>
      <div className="Sidebar">
        <div className='logo'>
          Scripture Habit
        </div>
        <div className="menu">
          {/* Dashboard */}
          <div className={selected === 0 ? 'menuItem active' : 'menuItem'}
            onClick={() => setSelected(0)}
          >
            <DashboardIcon />
            <span>{SidebarData[0].heading}</span>
          </div>

          {/* My Notes */}
          <div className={selected === 1 ? 'menuItem active' : 'menuItem'}
            onClick={() => setSelected(1)}
          >
            <NotesIcon />
            <span>{SidebarData[1].heading}</span>
          </div>

          {/* Desktop Groups Section */}
          <div className="groups-section desktop-groups">
            <div className="menu-header">My Groups</div>
            {userGroups.map((group) => (
              <div
                key={group.id}
                className={`menuItem ${selected === 2 && activeGroupId === group.id ? 'active' : ''}`}
                onClick={() => handleGroupClick(group.id)}
              >
                <UilUsersAlt />
                <span className="group-name-sidebar">{group.name}</span>
              </div>
            ))}

            {userGroups.length < 7 && (
              <div className="menuItem create-group-item" onClick={() => navigate('/group-options')}>
                <UilPlusCircle />
                <span>Join/Create Group</span>
              </div>
            )}
          </div>

          {/* Mobile Groups Trigger */}
          <div className={`menuItem mobile-groups-trigger ${selected === 2 ? 'active' : ''}`}
            onClick={() => setShowGroupModal(true)}
          >
            <UilUsersAlt />
          </div>

          <div className="menuItem sign-out" onClick={handleSignOut}>
            <UilSignOutAlt />
            <span>Sign Out</span>
          </div>
        </div>
      </div>

      {/* Mobile Group Selection Modal */}
      {showGroupModal && (
        <div className="group-modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="group-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Select Group</h3>
            <div className="modal-group-list">
              {userGroups.map((group) => (
                <div
                  key={group.id}
                  className={`modal-group-item ${activeGroupId === group.id ? 'active-group' : ''}`}
                  onClick={() => handleGroupClick(group.id)}
                >
                  <UilUsersAlt />
                  <span>{group.name}</span>
                </div>
              ))}
            </div>
            {userGroups.length < 7 && (
              <div className="modal-create-group" onClick={() => { navigate('/group-options'); setShowGroupModal(false); }}>
                <UilPlusCircle />
                <span>Join or Create New Group</span>
              </div>
            )}
            <button className="close-modal-btn" onClick={() => setShowGroupModal(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;