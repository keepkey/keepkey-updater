import React, { Component, Fragment } from 'react';
import { Button } from 'semantic-ui-react';
import HoldAndConnect from '../../images/hold-and-connect.svg';

const { ipcRenderer } = window.require('electron');

export default class Initial extends Component {
  constructor(props) {
    super(props);
    this.state = {
      initializedConfirmed: false,
      backupConfirmed: false,
    };
  }

  componentDidUpdate() {
    const { features, start, transitionState, deviceIsInitialized } = this.props;
    if(!features) { return null; }
    const { backupConfirmed } = this.state;
    const { bootloaderMode } = features;
    const approved = backupConfirmed || deviceIsInitialized === false // check for explicit false instead of falsy
    if(approved && bootloaderMode) {
      transitionState(start)
    }
    if (!(!this.state.initializedConfirmed) && !(deviceIsInitialized && !backupConfirmed) && !bootloaderMode) {
      this.props.updateTitleBar({ progress: 25 })
    }
    return null;
  }

  handleSetInitialized(isInitialized) {
    this.props.setDeviceIsInitialized(isInitialized)
    this.setState({ initializedConfirmed: true })
  }

  navigateToAssistance(e) {
    e.preventDefault()
    ipcRenderer.send('get-help')
  }

  render() {
    const { features, cancel, deviceIsInitialized } = this.props;
    const { backupConfirmed, initializedConfirmed } = this.state;

    if(!initializedConfirmed) {
      return(
        <div style={{ textAlign: 'center', fontSize: '15px' }}>
          <h1 style={{ color: '#FFFFFF' }}>Start Update</h1>
          <div>Please select an option:</div>
          <div style={buttonsContainerStyles}>
            <Button
              primary
              onClick={() => this.handleSetInitialized(false)}
            >THIS KEEPKEY IS NEW</Button>
            <Button
              primary
              onClick={() => this.handleSetInitialized(true)}
            >I'VE SET UP THIS KEEPKEY BEFORE</Button>
          </div>
        </div>
      )
    }

    if(deviceIsInitialized && !backupConfirmed) {
      return(
        <div style={{ textAlign: 'left', fontSize: '14px' }}>
          <h1 style={{ textAlign: 'center', color: '#FFFFFF' }}>Before You Proceed</h1>
          <div>Only continue if you have your recovery sentence.</div>
          <div>
            In the unlikely event that something goes wrong, you might not be able to access
            your funds without your recovery sentence.
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '15px 5px' }}>
            <Button
              primary
              style={{ width: '100%' }}
              onClick={() => this.setState({ backupConfirmed: true })}
            >I Have My Backup</Button>
          </div>
          <div style={{ textAlign: 'center' }}>If you don't have your recovery sentence</div>
          <div style={warningLinksStyles}>
            <a style={{ cursor: 'pointer' }} onClick={this.navigateToAssistance}>Get assistance</a>
            <a style={{ cursor: 'pointer' }} onClick={cancel}>CANCEL UPDATE</a>
          </div>
        </div>
      );
    }

    const bootloaderMode = features && features.bootloader_mode;

    if(!bootloaderMode) {
      return(
        <Fragment>
          <h2 style={{ fontSize: '29px', fontWeight: 400, color: '#ffffff' }}>Ready to Update</h2>
          <span>
            Unplug the KeepKey and plug it back in while holding down the button.
          </span>
          <img style={holdAndConnectImgStyles} src={HoldAndConnect} alt="device outline" />
        </Fragment>
      );
    }

    return null;
  }
}

const buttonsContainerStyles = {
  marginTop: 20,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-around',
  height: 125
}

const holdAndConnectImgStyles = {
  position: 'absolute',
  bottom: -35,
  left: 'calc(50% - 168px)'
};

const warningLinksStyles = {
  marginTop: 5,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  alignItems: 'center',
  height: 75,
  fontWeight: 600
}
