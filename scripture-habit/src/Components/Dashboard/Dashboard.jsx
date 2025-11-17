import React from 'react';
import Hero from '../Hero/Hero';
import RightSide from '../RightSide/RightSide';
import Sidebar from '../Sidebar/Sidebar';
import './Dashboard.css';

const Dashboard  = () => {
  return (
    <div className='App Dashboard'>
      <div className='AppGlass Grid'>
          <Sidebar/>
          <Hero/>
          <RightSide/>
      </div>
   
    </div>
  );
};

export default Dashboard;