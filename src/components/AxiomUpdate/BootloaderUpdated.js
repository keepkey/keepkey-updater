import React, { Component, Fragment } from 'react';
import Updatable from '../Updatable';
import ConnectKeepKey from '../../images/connect-keepkey.svg';
import HoldAndConnect from '../../images/hold-and-connect.svg';

const stripV = (version) => version.replace(/v/g, '')

export default class BootloaderUpdated extends Component {
  constructor(props) {
    super(props)
    this.state = { readyForFirmwareUpdate: false }
  }

  componentDidUpdate(prevProps) {
    const { features, firmwareData } = this.props;
    if(!features) return null
    const reconnectInBootloaderMode = !prevProps.features
      && features.bootloaderMode
      && firmwareData?.latest?.bootloader?.version === features.bootloaderVersion
    if(reconnectInBootloaderMode && !this.state.readyForFirmwareUpdate) {
      this.setState({ readyForFirmwareUpdate: true })
      this.props.updateTitleBar({ title: 'Bootloader Updated', progress: 100 })
    }
    if (this.state.readyForFirmwareUpdate) {
      this.props.updateTitleBar({ progress: 50 })
    }
  }

  initiateFirmwareUpdate() {
    this.props.transitionState('UPDATE_FIRMWARE')
  }

  render() {
    if (this.state.readyForFirmwareUpdate) {
      const { bootloaderVersion } = this.props.features
      return(
        <div>
          <h1>Bootloader Updated</h1>
          <p>Now you just need to update the firmware.</p>
          <div>
            <Updatable
              title="bootloader"
              current={true}
              version={stripV(bootloaderVersion)}
              showStatus={true}
            />
            <Updatable
              title="firmware"
              current={false}
              version={'--'}
              showStatus={true}
              handleUpdateClick={() => this.initiateFirmwareUpdate()}
            />
          </div>
        </div>
      )
    }
    return(
      <Fragment>
        <h2 style={{ fontSize: '29px', fontWeight: 400, color: '#ffffff' }}>Ready to Update Bootloader</h2>
        <span>If your KeepKey does not automatically reboot within the next few seconds, unplug it and plug it back in.</span>
        <img style={ConnectKeepKeyStyles} src={ConnectKeepKey} alt="device outline" />
      </Fragment>
    );
  }
}

const stepAndImageContainerStyles = {
  position: 'relative',
  overflow: 'hidden'
}

const stepContainerStyles = {
  display: 'flex'
};

const stepTextStyles = {
  flex: 6,
  fontSize: '12px',
  textAlign: 'left'
};

const stepNumberStyles = {
  flex: 1,
  fontWeight: 'bold',
  fontSize: '22px'
};

const connectImageStyles = {
  position: 'absolute',
  width: 175,
  bottom: -30,
  left: 'calc(50% - 95px)'
};

const connectAndHoldImageStyles = {
  position: 'absolute',
  width: 204,
  bottom: -22,
  left: 'calc(50% - 110px)'
};
