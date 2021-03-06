import React, { Fragment, useState } from 'react';
import { Button } from 'semantic-ui-react'

import useKeyPress from '../hooks/useKeyPress';

const { ipcRenderer } = window.require('electron');

function navigateToHelp(e) {
  ipcRenderer.send('get-help')
}

function renderWarning(props, state, setState, showCustom) {
  return(
    <div style={{ textAlign: 'left' }}>
      <p>
        You probably got to this screen by accident. No problem -- it happens! Just unplug
        your KeepKey and plug it back in (without holding the button).
      </p>
      <div style={{ width: 100, height: 1, margin: '10px auto',  backgroundColor: 'rgb(135, 152, 173)' }} />
      <p>
        If you're following the instructions of a KeepKey customer support agent, you're
        in the right place.
      </p>
      <p><a style={{ cursor: 'pointer' }} onClick={() => setState({ showUpdates: true })}>
        Click here if advised by customer support.
      </a></p>
      <p style={{ color: '#FFFFFF', marginTop: 60, textAlign: 'center' }}>
        Keep seeing this screen? <a style={{ cursor: 'pointer', marginLeft: '0.5em' }} onClick={navigateToHelp}>Get Help</a>
      </p>
    </div>
  )
}

function renderOptions(props, state, setState, showCustom) {
  const { initiateUpdate, firmwareData, features } = props;
  const latestBootloaderVersion = firmwareData?.latest?.bootloader?.version;
  return(
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', height: 280 }}>
      { latestBootloaderVersion && <Button primary onClick={() => initiateUpdate('UPDATE_BOOTLOADER')}>Update Bootloader & Firmware</Button> }
      { features?.bootloaderVersion === latestBootloaderVersion &&
        <Button primary onClick={() => initiateUpdate('UPDATE_FIRMWARE')}>Update Firmware</Button> }
      { showCustom && <Button primary onClick={() => initiateUpdate('UPDATE_CUSTOM')}>Update From File</Button> }
        <p>
          Not sure how you got to this screen?
          <br />
          Unplug your KeepKey and plug it back in.
        </p>
        <p style={{ color: '#FFFFFF', justifySelf: 'flex-end' }}>
          Confused? <a style={{ cursor: 'pointer', marginLeft: '0.5em' }} onClick={navigateToHelp}>Get Help</a>
        </p>
    </div>
  )
}

export default function BootloaderMode(props) {
  const [state, setState] = useState({
    showUpdates: false,
  });
  const showCustom = useKeyPress("Shift");
  return(
    <Fragment>
      <h1 style={{ color: '#FFFFFF', textAlign: 'center' }}>Update Mode</h1>
      { (state.showUpdates ? renderOptions : renderWarning)(props, state, setState, showCustom) }
    </Fragment>
  )
}
