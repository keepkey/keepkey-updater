import React from 'react';
import ConnectKeepKey from '../images/connect-keepkey.svg'

const NoDevice = ({ updateTitleBar }) => {
  updateTitleBar({ title: 'KeepKey Updater', progress: 0 })
  return(
    <div style={noDeviceStyles}>
      <h1 style={{ color: '#ffffff' }}>No Device Connected</h1>
      <span style={{ fontSize: '15px' }}>
        If your KeepKey is connected, make sure you do not have the KeepKey Desktop App
        running or the ShapeShift platform running, and try reconnecting your KeepKey.
      </span>
      <img style={ConnectKeepKeyStyles} src={ConnectKeepKey} alt="device outline" />
    </div>
  );
}

const noDeviceStyles = {
  textAlign: 'center',
};

const ConnectKeepKeyStyles = {
  position: 'absolute',
  width: 292,
  bottom: -25,
  left: 'calc(50% - 155px)'
};

export default NoDevice;

