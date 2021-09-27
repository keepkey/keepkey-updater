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
    const { features, latest } = this.props;
    if(!features) return null
    const reconnectInBootloaderMode = !prevProps.features
      && features.bootloaderMode
      && latest.bootloader.version === features.bootloaderVersion
    if(reconnectInBootloaderMode && !this.state.readyForFirmwareUpdate) {
      this.setState({ readyForFirmwareUpdate: true })
    }
  }

  initiateFirmwareUpdate() {
    this.props.transitionState('UPDATE_FIRMWARE')
  }

  render() {
    if (this.state.readyForFirmwareUpdate) {
      const { bootloaderVersion } = this.props.features
      this.props.updateTitleBar({ title: 'Bootloader Updated', progress: 100 })
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
    this.props.updateTitleBar({ progress: 50 })
    return(
      <Fragment>
        <div style={{ ...stepAndImageContainerStyles, height: 140 }}>
          <div style={stepContainerStyles}>
            <div style={stepNumberStyles}>1</div>
            <div style={stepTextStyles}>
              Disconnect your KeepKey and reconnect it.
            </div>
          </div>
          <img
            style={connectImageStyles}
            src={ConnectKeepKey}
            alt="reconnect keepkey"
          />
        </div>
        <div style={{ ...stepAndImageContainerStyles, height: 214 }}>
          <div style={stepContainerStyles}>
            <div style={stepNumberStyles}>2</div>
            <div style={stepTextStyles}>
              When you see the confirmation on your KeepKey that the bootloader
              has successfully updated, please disconnect your KeepKey and
              reconnect it <strong>while holding the button.</strong>
            </div>
          </div>
          <div>
            <img
              style={connectAndHoldImageStyles}
              src={HoldAndConnect}
              alt="hold and connect keepkey"
            />
          </div>
        </div>
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
