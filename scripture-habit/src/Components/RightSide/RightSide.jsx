import React from 'react';
import GroupChat from '../GroupChat/GroupChat';
import ProgressBar from '../ProgressBar/ProgressBar';

const RightSide = () => {
  return (
    <div className="RightSide">
      <div>
        <h3>Group Chat</h3>à
        <GroupChat/>
      </div>
      <div>
        <h3>My Progress</h3>
        <ProgressBar/>
        <h3>Group Progress</h3>
        <ProgressBar/>
      </div>
    </div>
  );
};

export default RightSide;