import React from 'react';
import Main from './components/Main';
import Background from './images/Background.svg';

export default () => {
  return (
    <div style={appStyles}>
      <Main />
    </div>
  );
}

const appStyles= {
  backgroundImage: `url(${Background})`,
  backgroundSize: 'cover',
  height: '100vh',
  overflow: 'hidden',
  padding: '0px 40px',
  position: 'relative',
  color: '#8798AD'
};

