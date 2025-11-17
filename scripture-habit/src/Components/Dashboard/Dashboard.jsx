import React from 'react';
import Hero from './Components/Hero/Hero';
import RightSide from './Components/RightSide/RightSide';
import Sidebar from './Components/Sidebar/Sidebar';


const Dashboard  = () => {
  return (
    <div className='App'>
      <div className='AppGlass'>
          <Sidebar/>
          <Hero/>
          <RightSide/>
      </div>
   
    </div>
  );
};

export default Dashboard;