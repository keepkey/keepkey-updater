import React from 'react';
import UpdateDot from '../images/update-dot.svg';

export default (props) => {
  const { title, version, current, handleUpdateClick, showStatus } = props
  return(
    <div style={updatableStyles}>
      <div style={dotStyles}>
        { !current &&
          <img src={UpdateDot} alt="red dot" /> }
      </div>
      <div style={{ flex: 5 }}>
        {title.charAt(0).toUpperCase() + title.slice(1)}
      </div>
      <div style={{ flex: 2, textAlign: 'right', color: current ? '#66BB69' : 'inherit' }}>
        {version}
      </div>
      { showStatus ?
        <div style={{ fontSize: 13, fontWeight: 600, flex: 3.5, paddingLeft: 20 }}>
          {current ?
            <span style={{ color: '#66BB69' }}>&#10004;</span> :
            <a style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={handleUpdateClick}>Update Now</a>
          }
        </div> :
        <div style={{ flex: 3.5, paddingLeft: 20 }}></div>
      }
    </div>
  )
}

const updatableStyles = {
  display: 'flex',
  fontSize: 19,
  margin: '10px auto',
  textAlign: 'left',
}

const dotStyles = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  paddingRight: 7
};
